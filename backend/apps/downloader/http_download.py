"""
Direct HTTP(S) downloads with SSRF checks and resume (Range).
"""
from __future__ import annotations

import ipaddress
import re
import socket
import time
from email.message import Message
from pathlib import Path
from typing import Callable
from urllib.parse import urlparse

import httpx
from django.conf import settings


def _max_bytes() -> int:
    return int(getattr(settings, "DOWNLOAD_HTTP_MAX_BYTES", 5 * 1024**3))


def _max_redirects() -> int:
    return int(getattr(settings, "DOWNLOAD_HTTP_MAX_REDIRECTS", 8))


def _chunk_bytes() -> int:
    return int(getattr(settings, "DOWNLOAD_HTTP_CHUNK_BYTES", 1024 * 256))


class UnsafeUrlError(ValueError):
    pass


class PauseRequested(Exception):
    """Cooperative pause from worker loop."""


_PRIVATE_NETWORKS = (
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
)


def _is_blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
        return True
    for net in _PRIVATE_NETWORKS:
        if ip in net:
            return True
    return False


def assert_safe_http_url(url: str) -> None:
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https"):
        raise UnsafeUrlError("Only http(s) URLs are allowed")
    host = parsed.hostname
    if not host:
        raise UnsafeUrlError("Missing host")
    host_lower = host.lower()
    if host_lower in ("localhost",) or host_lower.endswith(".local"):
        raise UnsafeUrlError("Host not allowed")
    try:
        infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except OSError as e:
        raise UnsafeUrlError(f"DNS resolution failed: {e}") from e
    for info in infos:
        sockaddr = info[4]
        ip_str = sockaddr[0]
        ip = ipaddress.ip_address(ip_str)
        if _is_blocked_ip(ip):
            raise UnsafeUrlError(f"Target address not allowed: {ip_str}")


def _parse_filename_from_cd(value: str) -> str | None:
    if not value:
        return None
    msg = Message()
    msg["Content-Disposition"] = value
    disp = msg.get_content_disposition()
    if disp not in ("attachment", "inline"):
        return None
    fname = msg.get_filename()
    if fname:
        return Path(fname).name
    m = re.search(r'filename\*?=(?:UTF-8\'\')?["\']?([^"\';\n]+)', value, re.I)
    if m:
        return Path(m.group(1).strip()).name
    return None


def _resolve_redirect_url(current: str, location: str) -> str:
    return str(httpx.URL(location).resolve_with(httpx.URL(current)))


def head_probe(url: str) -> dict:
    """
    Safe HEAD with manual redirects; GET bytes=0-0 fallback.
    Returns final_url, content_type, content_length, accept_ranges, etag, last_modified, filename.
    """
    assert_safe_http_url(url)
    current = url.strip()
    with httpx.Client(
        timeout=httpx.Timeout(30.0, connect=10.0),
        follow_redirects=False,
        limits=httpx.Limits(max_connections=5, max_keepalive_connections=2),
    ) as client:
        for _ in range(_max_redirects() + 1):
            assert_safe_http_url(current)
            r = client.head(current, headers={"Accept-Encoding": "identity"})
            if r.status_code in (301, 302, 303, 307, 308):
                loc = r.headers.get("location")
                if not loc:
                    raise UnsafeUrlError("Redirect without Location")
                current = _resolve_redirect_url(current, loc)
                continue
            if r.status_code in (405, 501):
                r = client.get(
                    current,
                    headers={"Accept-Encoding": "identity", "Range": "bytes=0-0"},
                )
            r.raise_for_status()
            total = None
            cr = r.headers.get("content-range")
            if cr and "/" in cr:
                try:
                    total = int(cr.rsplit("/", 1)[-1])
                except ValueError:
                    total = None
            if total is None:
                try:
                    cl = int(r.headers.get("content-length") or "0")
                    total = cl if cl > 0 else None
                except ValueError:
                    total = None
            cd = r.headers.get("content-disposition") or ""
            return {
                "ok": True,
                "final_url": str(r.request.url),
                "content_type": (r.headers.get("content-type") or "").split(";")[0].strip(),
                "content_length": total,
                "accept_ranges": (r.headers.get("accept-ranges") or "").lower() == "bytes",
                "etag": (r.headers.get("etag") or "").strip(),
                "last_modified": (r.headers.get("last-modified") or "").strip(),
                "filename": _parse_filename_from_cd(cd),
            }
        raise UnsafeUrlError("Too many redirects")


def _fmt_speed(bps: float) -> str:
    if bps < 0 or bps != bps:
        return ""
    units = ["B/s", "KB/s", "MB/s", "GB/s"]
    v = float(bps)
    u = 0
    while v >= 1024 and u < len(units) - 1:
        v /= 1024.0
        u += 1
    return f"{v:.1f} {units[u]}"


def _fmt_eta(seconds: float) -> str:
    if seconds < 0 or seconds != seconds or seconds > 86400 * 30:
        return ""
    s = int(seconds)
    if s < 60:
        return f"{s}s"
    m, s = divmod(s, 60)
    if m < 60:
        return f"{m}m{s}s"
    h, m = divmod(m, 60)
    return f"{h}h{m}m"


def job_http_output_dir(job) -> Path:
    root: Path = settings.MEDIA_ROOT
    root.mkdir(parents=True, exist_ok=True)
    user_uuid = str(job.user.uuid)
    out = root / user_uuid / "http"
    out.mkdir(parents=True, exist_ok=True)
    return out


def _guess_ext_from_ct(ctype: str) -> str:
    cl = ctype.lower()
    if "jpeg" in cl or "jpg" in cl:
        return ".jpg"
    if "png" in cl:
        return ".png"
    if "webp" in cl:
        return ".webp"
    if "gif" in cl:
        return ".gif"
    if "pdf" in cl:
        return ".pdf"
    if "zip" in cl:
        return ".zip"
    if "mpeg" in cl or "mp3" in cl:
        return ".mp3"
    if "ogg" in cl:
        return ".ogg"
    if "wav" in cl:
        return ".wav"
    return ""


def run_http_download(
    job,
    *,
    progress_callback: Callable[[int, int, float, str, str], None] | None = None,
    status_getter: Callable[[], str] | None = None,
) -> dict:
    """
    Stream download to MEDIA_ROOT/<user_uuid>/http/.

    progress_callback(done_bytes, total_bytes, speed_bps, speed_str, eta_str)
    """
    from apps.downloader.models import DownloadJob, DownloadJobMetrics

    assert_safe_http_url(job.source_url)

    def _status() -> str:
        if status_getter:
            return status_getter()
        job.refresh_from_db(fields=["status"])
        return job.status

    if _status() == DownloadJob.Status.PAUSED:
        raise PauseRequested()

    probe = head_probe(job.source_url)
    final_url = probe["final_url"]
    total = int(probe["content_length"] or 0)
    etag = probe.get("etag") or ""
    lm = probe.get("last_modified") or ""
    ctype = probe.get("content_type") or ""

    out_dir = job_http_output_dir(job)
    safe_title = re.sub(r"[^\w.\-]+", "_", (job.title or "file")[:120]).strip("._") or "file"
    ext = Path(urlparse(final_url).path).suffix[:10]
    if not ext:
        ext = _guess_ext_from_ct(ctype)
    if not ext and probe.get("filename"):
        ext = Path(probe["filename"]).suffix[:10] or ""
    base_name = f"{job.id.hex[:8]}_{safe_title}{ext or ''}"
    full_path = out_dir / base_name

    media_root = Path(settings.MEDIA_ROOT)
    start_off = 0
    metrics, _ = DownloadJobMetrics.objects.get_or_create(job=job)
    partial = metrics.partial_rel_path or ""
    if partial:
        disk = media_root / partial.replace("/", Path.sep)
        try:
            if disk.is_file() and disk.resolve().parent == out_dir.resolve():
                full_path = disk
                start_off = full_path.stat().st_size
        except OSError:
            start_off = 0

    if start_off > 0 and total > 0 and start_off >= total:
        start_off = 0

    headers: dict[str, str] = {"Accept-Encoding": "identity"}
    if start_off > 0:
        headers["Range"] = f"bytes={start_off}-"
        ir = metrics.resume_etag or etag
        if ir:
            headers["If-Range"] = ir

    max_bytes = _max_bytes()
    if total and total > max_bytes:
        raise RuntimeError("Remote file exceeds configured maximum size")

    mode = "ab" if start_off > 0 and full_path.exists() else "wb"
    if mode == "wb":
        full_path.unlink(missing_ok=True)

    rel = str(full_path.relative_to(media_root)).replace("\\", "/")
    DownloadJobMetrics.objects.filter(pk=metrics.pk).update(
        partial_rel_path=rel,
        bytes_total=total,
        resume_etag=etag,
        resume_last_modified=lm,
        content_type=ctype[:255],
        bytes_downloaded=start_off,
    )

    last_tick = time.monotonic()
    last_bytes = start_off
    downloaded = start_off

    def _emit() -> None:
        nonlocal last_tick, last_bytes
        if not progress_callback:
            return
        now = time.monotonic()
        if now - last_tick < 0.2 and not (total and downloaded >= total):
            return
        dt = now - last_tick
        speed_bps = (downloaded - last_bytes) / dt if dt > 0 else 0.0
        last_tick = now
        last_bytes = downloaded
        eta = ""
        if total > downloaded and speed_bps > 0:
            eta = _fmt_eta((total - downloaded) / speed_bps)
        progress_callback(
            downloaded,
            total,
            speed_bps,
            _fmt_speed(speed_bps),
            eta,
        )

    assert_safe_http_url(final_url)
    with httpx.Client(
        timeout=httpx.Timeout(3600.0, connect=30.0),
        follow_redirects=False,
        limits=httpx.Limits(max_connections=8, max_keepalive_connections=4),
    ) as client:
        with client.stream("GET", final_url, headers=headers) as r:
            if r.status_code in (301, 302, 303, 307, 308):
                raise RuntimeError("Unexpected redirect during download")
            r.raise_for_status()
            if start_off > 0 and r.status_code != 206:
                full_path.unlink(missing_ok=True)
                raise RuntimeError("resume_not_supported")
            if r.status_code == 206 and r.headers.get("content-range"):
                cr = r.headers["content-range"]
                if "/" in cr:
                    try:
                        total = int(cr.rsplit("/", 1)[-1])
                    except ValueError:
                        pass
            with open(full_path, mode) as f:
                if mode == "ab":
                    f.seek(0, 2)
                try:
                    for chunk in r.iter_bytes(_chunk_bytes()):
                        if _status() == DownloadJob.Status.CANCELLED:
                            raise RuntimeError("cancelled")
                        if _status() == DownloadJob.Status.PAUSED:
                            raise PauseRequested()
                        if not chunk:
                            continue
                        downloaded += len(chunk)
                        if downloaded > max_bytes:
                            raise RuntimeError("File exceeds configured maximum size")
                        f.write(chunk)
                        _emit()
                except PauseRequested:
                    if total:
                        pct = min(99, int(downloaded * 100 / total))
                    else:
                        pct = 0
                    DownloadJob.objects.filter(pk=job.pk).update(status=DownloadJob.Status.PAUSED)
                    DownloadJobMetrics.objects.filter(job_id=job.pk).update(
                        bytes_downloaded=downloaded,
                        progress_pct=pct,
                        last_speed_str="",
                        last_eta_str="",
                    )
                    raise

    size = full_path.stat().st_size if full_path.exists() else 0

    return {
        "filepath": rel,
        "filesize": size,
        "title": job.title or base_name,
        "content_type": ctype,
        "etag": etag or (probe.get("etag") or ""),
        "last_modified": lm or (probe.get("last_modified") or ""),
        "expected_size": total or size,
    }
