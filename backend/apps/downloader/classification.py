"""
Decide yt-dlp vs native HTTP for a URL (shared by analyze hints and job creation).
"""
from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse

from apps.downloader.http_download import head_probe
from apps.downloader.models import ENGINE_HTTP, ENGINE_YTDLP, DownloadJob
from apps.downloader.ytdlp_utils import (
    IMAGE_EXTENSIONS,
    KNOWN_MEDIA_HOSTS,
    analyze_url,
)

ARCHIVE_EXTENSIONS = frozenset({"zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"})
DOC_EXTENSIONS = frozenset({"pdf", "doc", "docx", "xls", "xlsx", "txt", "csv", "json", "xml", "md", "html", "htm"})


def _path_ext(url: str) -> str:
    base = url.strip().split("?", 1)[0].lower()
    if "." not in base:
        return ""
    return base.rsplit(".", 1)[-1]


def _media_kind_from_extension(ext: str) -> str:
    ext = ext.lower().lstrip(".")
    if ext in IMAGE_EXTENSIONS:
        return DownloadJob.MediaKind.IMAGE
    if ext in ("mp3", "m4a", "aac", "ogg", "opus", "wav", "flac"):
        return DownloadJob.MediaKind.AUDIO
    if ext in ("mp4", "webm", "mkv", "mov", "avi", "m4v"):
        return DownloadJob.MediaKind.VIDEO
    if ext in ARCHIVE_EXTENSIONS:
        return DownloadJob.MediaKind.ARCHIVE
    if ext in DOC_EXTENSIONS:
        return DownloadJob.MediaKind.DOCUMENT
    return DownloadJob.MediaKind.OTHER


def _suggested_title_from_url(url: str) -> str:
    path = urlparse(url.strip()).path
    name = Path(path).name
    return (name or "download")[:512]


def _capabilities(engine: str) -> dict:
    http = engine == ENGINE_HTTP
    return {
        "pause_supported": http,
        "resume_supported": http,
        "multiconn_supported": False,
    }


def classify_download(url: str) -> dict:
    """
    Returns engine, media_kind, suggested_title, capabilities, reason.
    """
    url = (url or "").strip()
    if not url:
        return {
            "engine": ENGINE_YTDLP,
            "media_kind": DownloadJob.MediaKind.OTHER,
            "suggested_title": "",
            "capabilities": _capabilities(ENGINE_YTDLP),
            "reason": "empty_url",
        }

    ext = _path_ext(url)
    if ext:
        mk = _media_kind_from_extension(ext)
        known_direct = mk != DownloadJob.MediaKind.OTHER or ext in ARCHIVE_EXTENSIONS or ext in DOC_EXTENSIONS
        if known_direct:
            return {
                "engine": ENGINE_HTTP,
                "media_kind": mk,
                "suggested_title": _suggested_title_from_url(url),
                "capabilities": _capabilities(ENGINE_HTTP),
                "reason": "url_extension_direct",
            }

    analysis = analyze_url(url)
    if not analysis.get("ok"):
        return {
            "engine": ENGINE_YTDLP,
            "media_kind": DownloadJob.MediaKind.OTHER,
            "suggested_title": "",
            "capabilities": _capabilities(ENGINE_YTDLP),
            "reason": "analyze_failed_use_ytdlp",
        }

    if analysis.get("is_playlist"):
        return {
            "engine": ENGINE_YTDLP,
            "media_kind": DownloadJob.MediaKind.VIDEO,
            "suggested_title": (analysis.get("title") or "")[:512],
            "capabilities": _capabilities(ENGINE_YTDLP),
            "reason": "playlist",
        }

    plat = analysis.get("platform") or "generic"
    media_kind = analysis.get("media_kind") or "unknown"
    if plat in KNOWN_MEDIA_HOSTS and media_kind in ("video", "audio"):
        return {
            "engine": ENGINE_YTDLP,
            "media_kind": DownloadJob.MediaKind.VIDEO
            if media_kind == "video"
            else DownloadJob.MediaKind.AUDIO,
            "suggested_title": (analysis.get("title") or "")[:512],
            "capabilities": _capabilities(ENGINE_YTDLP),
            "reason": "known_host_stream",
        }

    if plat in KNOWN_MEDIA_HOSTS and analysis.get("options_level") == "full":
        return {
            "engine": ENGINE_YTDLP,
            "media_kind": DownloadJob.MediaKind.VIDEO,
            "suggested_title": (analysis.get("title") or "")[:512],
            "capabilities": _capabilities(ENGINE_YTDLP),
            "reason": "known_host_full_controls",
        }

    try:
        probe = head_probe(url)
    except Exception:
        probe = None

    if probe and probe.get("ok"):
        ctype = (probe.get("content_type") or "").lower()
        fname = probe.get("filename") or ""
        clen = probe.get("content_length") or 0
        if fname or clen or "octet-stream" in ctype or "application/" in ctype or "image/" in ctype or "audio/" in ctype:
            mk = DownloadJob.MediaKind.OTHER
            if "image/" in ctype:
                mk = DownloadJob.MediaKind.IMAGE
            elif "audio/" in ctype:
                mk = DownloadJob.MediaKind.AUDIO
            elif "video/" in ctype:
                mk = DownloadJob.MediaKind.VIDEO
            elif "pdf" in ctype:
                mk = DownloadJob.MediaKind.DOCUMENT
            elif "zip" in ctype or "x-zip" in ctype:
                mk = DownloadJob.MediaKind.ARCHIVE
            title = fname or _suggested_title_from_url(url)
            return {
                "engine": ENGINE_HTTP,
                "media_kind": mk,
                "suggested_title": (title or _suggested_title_from_url(url))[:512],
                "capabilities": _capabilities(ENGINE_HTTP),
                "reason": "head_probe_direct",
            }

    return {
        "engine": ENGINE_YTDLP,
        "media_kind": DownloadJob.MediaKind.OTHER,
        "suggested_title": (analysis.get("title") or "")[:512],
        "capabilities": _capabilities(ENGINE_YTDLP),
        "reason": "default_ytdlp",
    }
