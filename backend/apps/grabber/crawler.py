import asyncio
import hashlib
import logging
import os
import re
import urllib.parse
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from .filters import ALL_EXTENSIONS, classify_file_extension

logger = logging.getLogger(__name__)

CSS_URL_RE = re.compile(r"url\(['\"]?(.*?)['\"]?\)", re.IGNORECASE)
SCRIPT_SRC_RE = re.compile(r'src\s*=\s*["\']([^"\']+)["\']', re.IGNORECASE)
LINK_HREF_RE = re.compile(r'href\s*=\s*["\']([^"\']+)["\']', re.IGNORECASE)

DEFAULT_USER_AGENT = "AIO-Grabber/1.0"


def normalize_url(base: str, href: str) -> str:
    parsed = urlparse(href)
    if parsed.scheme and parsed.netloc:
        result = href
    else:
        result = urljoin(base, href)
    result = urllib.parse.urldefrag(result)[0]
    result = result.rstrip("/") or result
    return result


def extract_extension(url: str) -> str:
    path = urlparse(url).path
    _, ext = os.path.splitext(path)
    return ext.lower().lstrip(".")


def is_likely_file(url: str) -> bool:
    ext = extract_extension(url)
    return ext in ALL_EXTENSIONS


def extract_links_from_html(base_url: str, html: str):
    soup = BeautifulSoup(html, "lxml")
    links = set()

    for tag in soup.find_all(["a", "area"]):
        href = tag.get("href")
        if href and not href.startswith(("javascript:", "#", "mailto:", "tel:")):
            links.add(normalize_url(base_url, href))

    for tag in soup.find_all(["img", "video", "audio", "source", "iframe", "embed"]):
        src = tag.get("src")
        if src:
            links.add(normalize_url(base_url, src))

    for tag in soup.find_all("link"):
        href = tag.get("href")
        if href:
            links.add(normalize_url(base_url, href))

    for tag in soup.find_all("script"):
        src = tag.get("src")
        if src:
            links.add(normalize_url(base_url, src))

    for tag in soup.find_all(["object", "param"]):
        data = tag.get("data") or tag.get("value")
        if data and not data.startswith(("javascript:", "#")):
            links.add(normalize_url(base_url, data))

    return links


def extract_css_urls(base_url: str, css_text: str):
    urls = set()
    for match in CSS_URL_RE.finditer(css_text):
        url = match.group(1).strip("'\"")
        if url and not url.startswith(("data:", "#")):
            urls.add(normalize_url(base_url, url))
    return urls


def extract_inline_css_urls(base_url: str, html: str):
    soup = BeautifulSoup(html, "lxml")
    urls = set()

    for tag in soup.find_all(style=True):
        urls.update(extract_css_urls(base_url, tag["style"]))

    for tag in soup.find_all("link", rel="stylesheet"):
        href = tag.get("href")
        if href:
            urls.add(normalize_url(base_url, href))

    for tag in soup.find_all("style"):
        if tag.string:
            urls.update(extract_css_urls(base_url, tag.string))

    return urls


def extract_file_links(base_url: str, html: str):
    soup = BeautifulSoup(html, "lxml")
    files = {}

    tags_with_src = {
        "img": "image",
        "video": "video",
        "audio": "audio",
        "source": None,
        "embed": "other",
        "iframe": "other",
    }

    for tag_name, default_type in tags_with_src.items():
        for tag in soup.find_all(tag_name):
            src = tag.get("src") or tag.get("data")
            if src:
                url = normalize_url(base_url, src)
                ext = extract_extension(url)
                file_type = classify_file_extension(ext) if ext else (default_type or "other")
                name = os.path.basename(urlparse(url).path) or url[:60]
                files[url] = {"url": url, "file_name": name, "extension": ext, "file_type": file_type}

    for tag in soup.find_all("a"):
        href = tag.get("href")
        if href and is_likely_file(href):
            url = normalize_url(base_url, href)
            ext = extract_extension(url)
            file_type = classify_file_extension(ext)
            name = os.path.basename(urlparse(url).path) or url[:60]
            files[url] = {"url": url, "file_name": name, "extension": ext, "file_type": file_type}

    return list(files.values())


class Crawler:
    def __init__(
        self,
        project,
        semaphore: asyncio.Semaphore,
        client: httpx.AsyncClient,
        filter_engine=None,
    ):
        self.project = project
        self.semaphore = semaphore
        self.client = client
        self.filter_engine = filter_engine
        self.visited_urls: set = set()
        self.stop_requested = False

    async def crawl_url(self, url: str, depth: int, max_depth: int):
        if self.stop_requested:
            return [], []

        if url in self.visited_urls:
            return [], []
        self.visited_urls.add(url)

        if depth > max_depth:
            return [], []

        if self.filter_engine and not self.filter_engine.should_crawl_url(url):
            return [], []

        async with self.semaphore:
            try:
                headers = {"User-Agent": self.project.user_agent or DEFAULT_USER_AGENT}
                resp = await self.client.get(url, headers=headers, follow_redirects=True, timeout=30)
                resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    retry_after = e.response.headers.get("Retry-After", "5")
                    await asyncio.sleep(int(retry_after))
                    return await self.crawl_url(url, depth, max_depth)
                return [], []
            except Exception as e:
                logger.warning("Failed to crawl %s: %s", url, e)
                return [], []

        content_type = resp.headers.get("content-type", "").lower()
        html_bytes = resp.content
        content = html_bytes.decode("utf-8", errors="replace")

        discovered_links = set()
        discovered_files = []

        if "text/html" in content_type:
            discovered_links = extract_links_from_html(url, content)
            css_urls = extract_inline_css_urls(url, content)
            discovered_links.update(css_urls)
            discovered_files = extract_file_links(url, content)

        elif "text/css" in content_type:
            css_urls = extract_css_urls(url, content)
            discovered_links.update(css_urls)

        child_tasks = []
        for link in discovered_links:
            if link not in self.visited_urls:
                child_tasks.append({
                    "url": link,
                    "depth": depth + 1,
                })

        files = []
        for file_info in discovered_files:
            if self.filter_engine and not self.filter_engine.should_download_file(
                file_info["url"], file_info["extension"], 0
            ):
                continue
            files.append(file_info)

        return child_tasks, files


class PlaywrightCrawler(Crawler):
    async def crawl_url(self, url: str, depth: int, max_depth: int):
        if self.stop_requested:
            return [], []

        if url in self.visited_urls:
            return [], []
        self.visited_urls.add(url)

        if depth > max_depth:
            return [], []

        if self.filter_engine and not self.filter_engine.should_crawl_url(url):
            return [], []

        async with self.semaphore:
            try:
                from playwright.async_api import async_playwright
            except ImportError:
                logger.error("Playwright not installed. Install with: pip install playwright && playwright install chromium")
                return [], []

            content = None
            final_url = url
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page(user_agent=self.project.user_agent or DEFAULT_USER_AGENT)
                try:
                    await page.goto(url, wait_until="networkidle", timeout=30000)
                    content = await page.content()
                    final_url = page.url
                except Exception as e:
                    logger.warning("Playwright crawl failed for %s: %s", url, e)
                    return [], []
                finally:
                    await browser.close()

            if not content:
                return [], []

            discovered_links = extract_links_from_html(final_url, content)
            css_urls = extract_inline_css_urls(final_url, content)
            discovered_links.update(css_urls)
            discovered_files = extract_file_links(final_url, content)

            child_tasks = []
            for link in discovered_links:
                if link not in self.visited_urls:
                    child_tasks.append({
                        "url": link,
                        "depth": depth + 1,
                    })

            files = []
            for file_info in discovered_files:
                if self.filter_engine and not self.filter_engine.should_download_file(
                    file_info["url"], file_info["extension"], 0
                ):
                    continue
                files.append(file_info)

            return child_tasks, files


async def run_crawl(project, filter_engine, progress_callback=None):
    max_depth = project.max_depth
    max_pages = project.max_pages
    max_files = project.max_files
    concurrency = project.concurrency

    semaphore = asyncio.Semaphore(concurrency)

    async with httpx.AsyncClient(
        timeout=30,
        limits=httpx.Limits(max_connections=concurrency + 5),
        headers={"User-Agent": project.user_agent or DEFAULT_USER_AGENT},
    ) as client:
        crawler_class = PlaywrightCrawler if project.use_javascript else Crawler
        crawler = crawler_class(project, semaphore, client, filter_engine)

        page_count = 0
        file_count = 0

        pending = [{"url": project.start_url, "depth": 0}]
        visited = set()

        while pending and not crawler.stop_requested:
            if page_count >= max_pages:
                break
            if file_count >= max_files:
                break

            batch = pending[:concurrency]
            pending = pending[concurrency:]

            tasks = []
            for item in batch:
                if item["url"] in visited:
                    continue
                visited.add(item["url"])
                tasks.append(crawler.crawl_url(item["url"], item["depth"], max_depth))

            results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in results:
                if isinstance(result, Exception):
                    logger.error("Crawl error: %s", result)
                    continue
                child_tasks, files = result
                for child in child_tasks:
                    if child["url"] not in visited:
                        pending.append(child)

                if progress_callback:
                    await progress_callback(len(child_tasks), len(files), page_count, file_count)

                page_count += 1
                file_count += len(files)

                for file_info in files[: max_files - file_count]:
                    yield file_info
                    file_count += 1
                    if file_count >= max_files:
                        break

                if file_count >= max_files:
                    break
