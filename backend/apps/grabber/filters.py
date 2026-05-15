import fnmatch
import re
from urllib.parse import urlparse


class FilterEngine:
    def __init__(self, project):
        self.project = project
        self.include_filters = list(project.filters.filter(filter_type="include"))
        self.exclude_filters = list(project.filters.filter(filter_type="exclude"))

    def should_crawl_url(self, url: str) -> bool:
        if not self._passes_exclude(url):
            return False
        if self.include_filters:
            return self._passes_include(url)
        return True

    def should_download_file(self, file_url: str, file_ext: str, file_size: int = 0) -> bool:
        if self.include_filters:
            result = self._matches_filters(self.include_filters, file_url, file_ext, file_size)
            if not result["matched"]:
                return False
        if self._matches_filters(self.exclude_filters, file_url, file_ext, file_size)["matched"]:
            return False
        return True

    def _passes_include(self, url: str) -> bool:
        result = self._matches_filters(self.include_filters, url, "", 0)
        return result["matched"]

    def _passes_exclude(self, url: str) -> bool:
        result = self._matches_filters(self.exclude_filters, url, "", 0)
        return not result["matched"]

    def _matches_filters(self, filters, url: str, file_ext: str, file_size: int):
        if not filters:
            return {"matched": False, "filter": None}
        parsed = urlparse(url)
        domain = parsed.netloc
        for f in filters:
            value = self._get_target_value(f.target, url, file_ext, file_size, domain)
            if self._match_pattern(f.pattern, value, f.is_regex):
                return {"matched": True, "filter": f}
        return {"matched": False, "filter": None}

    def _get_target_value(self, target: str, url: str, file_ext: str, file_size: int, domain: str) -> str:
        if target == "url":
            return url
        if target == "file_type":
            return file_ext
        if target == "file_size":
            return str(file_size)
        if target == "domain":
            return domain
        if target == "keyword":
            return url
        return url

    def _match_pattern(self, pattern: str, value: str, is_regex: bool) -> bool:
        if not value:
            return False
        if is_regex:
            try:
                if re.search(pattern, value, re.IGNORECASE):
                    return True
                if re.search(pattern, f".{value}", re.IGNORECASE):
                    return True
                return False
            except re.error:
                return False
        p = pattern.lower()
        v = value.lower()
        if "*" not in p and "?" not in p and p.isdigit() and v.isdigit():
            return p == v
        if "*" not in p and "?" not in p:
            return p in v
        if fnmatch.fnmatch(v, p):
            return True
        if fnmatch.fnmatch(f".{v}", p):
            return True
        if fnmatch.fnmatch(v, p.lstrip("*.")):
            return True
        return False


FILE_TYPE_EXTENSIONS = {
    "image": {"jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "avif", "heic", "heif"},
    "video": {"mp4", "webm", "avi", "mkv", "mov", "flv", "wmv", "m4v", "3gp", "ts", "mts"},
    "audio": {"mp3", "wav", "ogg", "flac", "aac", "wma", "m4a", "opus", "wv"},
    "document": {"pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf", "odt", "csv", "md", "epub"},
    "archive": {"zip", "rar", "7z", "tar", "gz", "bz2", "xz", "zst", "tgz"},
}
ALL_EXTENSIONS = set().union(*FILE_TYPE_EXTENSIONS.values())


def classify_file_extension(ext: str):
    ext = ext.lower().lstrip(".")
    for file_type, extensions in FILE_TYPE_EXTENSIONS.items():
        if ext in extensions:
            return file_type
    return "other"
