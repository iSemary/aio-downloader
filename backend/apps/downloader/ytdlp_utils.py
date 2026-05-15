from __future__ import annotations

import re
from pathlib import Path

import yt_dlp
from django.conf import settings

PLATFORM_PATTERNS = {
    "youtube": r"(youtube\.com|youtu\.be)",
    "instagram": r"instagram\.com",
    "facebook": r"(facebook\.com|fb\.watch)",
    "tiktok": r"tiktok\.com",
    "twitter": r"(twitter\.com|x\.com)",
    "vimeo": r"vimeo\.com",
    "twitch": r"twitch\.tv",
    "reddit": r"reddit\.com",
}

# Hosts where we commonly expect video/audio streams (still gated on actual probe signals).
KNOWN_MEDIA_HOSTS = frozenset(PLATFORM_PATTERNS.keys())


def detect_platform(url: str) -> str:
    for name, pat in PLATFORM_PATTERNS.items():
        if re.search(pat, url, re.I):
            return name
    return "generic"


IMAGE_EXTENSIONS = frozenset({"jpg", "jpeg", "png", "gif", "webp", "bmp", "avif", "svg"})
AUDIO_EXTENSIONS = frozenset({".mp3", ".m4a", ".aac", ".ogg", ".opus", ".wav", ".flac"})
VIDEO_EXTENSIONS = frozenset({".mp4", ".webm", ".mkv", ".mov", ".avi", ".m4v"})


def _vcodec_is_video(vc: object) -> bool:
    if not vc:
        return False
    s = str(vc).lower()
    return s not in ("none", "none?", "null")


def _acodec_is_audio(ac: object) -> bool:
    if not ac:
        return False
    s = str(ac).lower()
    return s not in ("none", "none?", "null")


def _formats_have_video(formats: list | None) -> bool:
    for f in formats or []:
        if _vcodec_is_video(f.get("vcodec")):
            return True
    return False


def _formats_have_audio_only_stream(formats: list | None) -> bool:
    for f in formats or []:
        if _acodec_is_audio(f.get("acodec")) and not _vcodec_is_video(f.get("vcodec")):
            return True
    return False


def _first_nested_entry(info: dict) -> dict | None:
    entries = info.get("entries")
    if not entries:
        return None
    for e in entries:
        if isinstance(e, dict) and e:
            return e
    return None


def _info_has_video(info: dict) -> bool:
    if _vcodec_is_video(info.get("vcodec")):
        return True
    if _formats_have_video(info.get("formats")):
        return True
    nested = _first_nested_entry(info)
    if nested and nested is not info:
        return _info_has_video(nested)
    return False


def _info_has_audio_only_stream(info: dict) -> bool:
    if _formats_have_audio_only_stream(info.get("formats")):
        return True
    nested = _first_nested_entry(info)
    if nested and nested is not info:
        return _info_has_audio_only_stream(nested)
    return False


def _playlist_entry_count(info: dict) -> int:
    entries = info.get("entries") or []
    return len([e for e in entries if e])


def _is_probably_image(info: dict, url: str) -> bool:
    ie = (info.get("ie_key") or info.get("extractor_key") or info.get("extractor") or "").lower()
    if "image" in ie or "photo" in ie:
        return True
    ext = (info.get("ext") or "").lower()
    if ext in IMAGE_EXTENSIONS and not _info_has_video(info) and not info.get("duration"):
        return True
    path = url.split("?", 1)[0].lower()
    if path.rsplit(".", 1)[-1] in IMAGE_EXTENSIONS:
        return True
    return False


def _url_extension_hint(url: str) -> str | None:
    base = url.strip().split("?", 1)[0].lower()
    if "." not in base:
        return None
    return base.rsplit(".", 1)[-1]


def analyze_url(url: str) -> dict:
    """
    Lightweight URL analysis for UI: platform, media kind, and which option groups to show.

    options_level:
      - none: hide format/quality; use defaults (images, plain pages, unknown).
      - audio: show audio-oriented format choices.
      - full: show video format + resolution/quality.
    """
    url = (url or "").strip()
    if not url:
        return {
            "ok": False,
            "error": "empty_url",
            "platform": "generic",
            "options_level": "none",
            "media_kind": "unknown",
            "defaults": {"format": "mp4", "quality": "best"},
            "allowed_formats": ["mp4"],
            "allowed_qualities": ["best"],
        }

    platform = detect_platform(url)
    ext_hint = _url_extension_hint(url)

    def _fail_payload(exc: Exception) -> dict:
        return {
            "ok": False,
            "error": "extract_failed",
            "detail": str(exc)[:800],
            "platform": platform,
            "options_level": "none",
            "media_kind": "unknown",
            "defaults": {"format": "mp4", "quality": "best"},
            "allowed_formats": ["mp4"],
            "allowed_qualities": ["best"],
            "title": "",
            "thumbnail": "",
        }

    # Fast path for obvious direct files (avoids brittle extractor errors in UI).
    path_lower = url.split("?", 1)[0].lower()
    for sfx in sorted(AUDIO_EXTENSIONS, key=len, reverse=True):
        if path_lower.endswith(sfx):
            return {
                "ok": True,
                "platform": platform,
                "title": "",
                "thumbnail": "",
                "duration_seconds": None,
                "is_playlist": False,
                "playlist_item_count": 1,
                "media_kind": "audio",
                "options_level": "audio",
                "defaults": {"format": "mp3", "quality": "best"},
                "allowed_formats": ["mp3", "webm"],
                "allowed_qualities": ["best", "audio_only"],
                "extractor_key": "direct",
                "uploader": "",
                "webpage_url": url,
            }
    for sfx in sorted(VIDEO_EXTENSIONS, key=len, reverse=True):
        if path_lower.endswith(sfx):
            return {
                "ok": True,
                "platform": platform,
                "title": "",
                "thumbnail": "",
                "duration_seconds": None,
                "is_playlist": False,
                "playlist_item_count": 1,
                "media_kind": "video",
                "options_level": "full",
                "defaults": {"format": "mp4", "quality": "best"},
                "allowed_formats": ["mp4", "mp3", "webm"],
                "allowed_qualities": ["best", "1080p", "720p", "480p", "audio_only"],
                "extractor_key": "direct",
                "uploader": "",
                "webpage_url": url,
            }

    ext = path_lower.rsplit(".", 1)[-1] if "." in path_lower else ""
    if ext in IMAGE_EXTENSIONS:
        return {
            "ok": True,
            "platform": platform,
            "title": "",
            "thumbnail": url,
            "duration_seconds": None,
            "is_playlist": False,
            "playlist_item_count": 1,
            "media_kind": "image",
            "options_level": "none",
            "defaults": {"format": "mp4", "quality": "best"},
            "allowed_formats": ["mp4"],
            "allowed_qualities": ["best"],
            "extractor_key": "direct",
            "uploader": "",
            "webpage_url": url,
        }

    try:
        opts: dict = {"quiet": True, "no_warnings": True, "skip_download": True, "ignoreerrors": True}
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as exc:  # noqa: BLE001
        return _fail_payload(exc)

    if not isinstance(info, dict):
        return _fail_payload(ValueError("Video is private or unavailable, or unsupported URL."))

    ie_key = (info.get("ie_key") or info.get("extractor_key") or info.get("extractor") or "").lower()
    ctype = info.get("_type") or "video"
    entry_count = _playlist_entry_count(info)
    is_playlist = ctype in ("playlist", "multi_video") or (entry_count > 1 and bool(info.get("entries")))

    has_video = _info_has_video(info)
    has_audio_only = _info_has_audio_only_stream(info)
    duration = info.get("duration")
    image_like = _is_probably_image(info, url)

    if image_like and not has_video:
        media_kind = "image"
        options_level = "none"
    elif has_video:
        media_kind = "video"
        options_level = "full"
    elif has_audio_only and (duration or platform in KNOWN_MEDIA_HOSTS):
        media_kind = "audio"
        options_level = "audio"
    elif platform in KNOWN_MEDIA_HOSTS and (duration or is_playlist):
        # Social URL that yt-dlp understood but codecs were not surfaced — still offer full controls.
        media_kind = "video"
        options_level = "full"
    elif ext_hint in ("mp3", "m4a", "aac", "ogg", "opus", "wav", "flac"):
        media_kind = "audio"
        options_level = "audio"
    elif ext_hint in ("mp4", "webm", "mkv", "mov", "avi", "m4v"):
        media_kind = "video"
        options_level = "full"
    else:
        media_kind = "generic"
        options_level = "none"

    title = (info.get("title") or "")[:512]
    thumbnail = info.get("thumbnail") or ""
    if not thumbnail and info.get("thumbnails"):
        thumbs = info["thumbnails"]
        if thumbs:
            thumbnail = (thumbs[-1] or {}).get("url") or ""

    if options_level == "full":
        defaults = {"format": "mp4", "quality": "best"}
        allowed_formats = ["mp4", "mp3", "webm"]
        allowed_qualities = ["best", "1080p", "720p", "480p", "audio_only"]
    elif options_level == "audio":
        defaults = {"format": "mp3", "quality": "best"}
        allowed_formats = ["mp3", "webm"]
        allowed_qualities = ["best", "audio_only"]
    else:
        defaults = {"format": "mp4", "quality": "best"}
        allowed_formats = ["mp4"]
        allowed_qualities = ["best"]

    uploader = (info.get("uploader") or info.get("channel") or info.get("uploader_id") or "")[:200]
    webpage = info.get("webpage_url") or url

    return {
        "ok": True,
        "platform": platform,
        "title": title,
        "thumbnail": thumbnail or "",
        "duration_seconds": duration,
        "is_playlist": bool(is_playlist and entry_count > 1),
        "playlist_item_count": entry_count if is_playlist else 1,
        "media_kind": media_kind,
        "options_level": options_level,
        "defaults": defaults,
        "allowed_formats": allowed_formats,
        "allowed_qualities": allowed_qualities,
        "extractor_key": ie_key,
        "uploader": uploader,
        "webpage_url": webpage,
    }


def probe_url(url: str) -> dict:
    """Return title, thumbnail, duration, is_playlist, entries (list of dicts with url/title)."""
    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "ignoreerrors": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)

    entries_out: list[dict] = []
    ctype = info.get("_type")
    is_playlist = ctype in ("playlist", "multi_video") or bool(info.get("entries"))

    if info.get("entries"):
        for e in info["entries"]:
            if not e:
                continue
            vid_url = e.get("webpage_url") or e.get("url")
            if vid_url and not str(vid_url).startswith("http"):
                vid = e.get("id")
                if vid and "youtube" in (info.get("webpage_url") or url):
                    vid_url = f"https://www.youtube.com/watch?v={vid}"
            entries_out.append(
                {
                    "url": vid_url or e.get("webpage_url") or url,
                    "title": e.get("title") or "Video",
                    "platform": detect_platform(str(vid_url or url)),
                }
            )

    if not entries_out:
        entries_out = [
            {
                "url": info.get("webpage_url") or url,
                "title": info.get("title") or "Video",
                "platform": detect_platform(url),
            }
        ]

    return {
        "title": info.get("title") or "",
        "thumbnail": info.get("thumbnail") or (info.get("thumbnails") or [{}])[-1].get("url", ""),
        "duration": info.get("duration"),
        "is_playlist": is_playlist and len(entries_out) > 1,
        "entries": entries_out,
        "raw": info,
    }


def job_output_dir(job) -> Path:
    """Where yt-dlp writes files: ``MEDIA_ROOT/<user_uuid>/<platform>/``."""
    root: Path = settings.MEDIA_ROOT
    root.mkdir(parents=True, exist_ok=True)
    user_uuid = str(job.user.uuid)
    plat = (job.platform or "generic").replace("/", "_").replace("\\", "_")[:64]
    out = root / user_uuid / plat
    out.mkdir(parents=True, exist_ok=True)
    return out


def _format_selector(quality: str, fmt: str) -> str:
    q = (quality or "best").lower()
    f = (fmt or "mp4").lower()
    if f == "mp3" or q == "audio_only":
        return "bestaudio/best"
    if q == "best":
        return "bestvideo+bestaudio/best"
    height_map = {"1080p": 1080, "720p": 720, "480p": 480}
    h = height_map.get(q)
    if h:
        return f"bestvideo[height<={h}]+bestaudio/best[height<={h}]/best"
    return "bestvideo+bestaudio/best"


def build_ydl_opts(job, progress_hook) -> dict:
    out_dir = job_output_dir(job)

    fmt = (job.format or "mp4").lower()
    merge = "mp4" if fmt == "mp4" else "webm" if fmt == "webm" else "mp4"

    postprocessors = []
    if fmt == "mp3":
        postprocessors = [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ]

    return {
        "format": _format_selector(job.quality, fmt),
        "outtmpl": str(out_dir / "%(title).200s.%(ext)s"),
        "merge_output_format": merge if fmt != "mp3" else None,
        "progress_hooks": [progress_hook],
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "postprocessors": postprocessors,
        "restrictfilenames": True,
        "retries": 3,
        "fragment_retries": 3,
    }


def run_download(job, progress_hook) -> dict:
    out_dir = job_output_dir(job)
    opts = build_ydl_opts(job, progress_hook)
    # Remove merge_output_format if None
    if opts.get("merge_output_format") is None:
        opts.pop("merge_output_format", None)

    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(job.source_url, download=True)

    requested = str(
        out_dir
        / f"{(info.get('title') or 'video')[:200]}.{info.get('ext') or ('mp3' if job.format == 'mp3' else 'mp4')}"
    )
    path = Path(requested)
    if not path.exists():
        # yt-dlp may sanitize differently; pick latest file in this job's output dir
        candidates = sorted(out_dir.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True)
        path = candidates[0] if candidates else path

    rel = str(path.relative_to(settings.MEDIA_ROOT)) if path.exists() else ""
    size = path.stat().st_size if path.exists() else 0

    return {
        "filepath": rel.replace("\\", "/"),
        "filesize": size,
        "title": info.get("title") or job.title,
        "platform": detect_platform(job.source_url),
    }


def create_jobs_from_url(url: str, user, format: str, quality: str) -> tuple[list[DownloadJob], DownloadJob | None]:
    """
    Returns (jobs_to_run_immediately, playlist_parent_or_none).
    For playlists: returns ([], parent) and caller should enqueue children.
    """
    from .models import DownloadJob

    probe = probe_url(url)
    entries = probe["entries"]

    if probe.get("is_playlist") and len(entries) > 1:
        parent = DownloadJob.objects.create(
            user=user,
            source_url=url,
            title=probe.get("title") or "Playlist",
            platform=detect_platform(url),
            format=format,
            quality=quality,
            status=DownloadJob.Status.PROCESSING,
        )
        return [], parent

    e = entries[0]
    job = DownloadJob.objects.create(
        user=user,
        source_url=e["url"],
        title=(e.get("title") or probe.get("title") or "")[:512],
        platform=e.get("platform") or detect_platform(url),
        format=format,
        quality=quality,
    )
    return [job], None
