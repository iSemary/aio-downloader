"""Parse yt-dlp / human-readable speed strings to bytes per second."""

import re

_SPEED_RE = re.compile(
    r"([\d.]+)\s*([KMGTPE]?)(i)?\s*B\s*/\s*s",
    re.IGNORECASE,
)


def parse_speed_str_to_bps(s: str) -> float | None:
    if not s or not str(s).strip():
        return None
    m = _SPEED_RE.search(str(s))
    if not m:
        return None
    try:
        val = float(m.group(1))
    except ValueError:
        return None
    unit = (m.group(2) or "").upper()
    is_iec = bool(m.group(3))  # "i" present -> KiB/MiB
    mult = 1024.0 if is_iec else 1000.0
    pow_map = {"": 0, "K": 1, "M": 2, "G": 3, "T": 4, "P": 5, "E": 6}
    p = pow_map.get(unit, None)
    if p is None:
        return None
    return val * (mult**p)
