# Site Grabber

The Site Grabber crawls websites to discover and download media files, documents, archives, and more — similar to IDM's Site Grabber feature.

## How it works

1. **Create a project** — Provide a starting URL and configure crawl depth, filters, concurrency, and limits.
2. **Start crawling** — The engine begins at the start URL, extracts links, follows them up to the configured depth, and discovers downloadable files.
3. **Review discovered files** — Browse files by type, search, and select which ones to download.
4. **Download** — Queued files go through the existing `DownloadJob` pipeline, appearing in Queue and History with full progress tracking, Telegram/GDrive integration support.
5. **Schedule (optional)** — Set a cron expression for automatic re-crawling.

## Key Features

- **Multi-Level Depth** — Crawl 0 (current page only) through 10 (deep crawl)
- **Filter Engine** — Include/exclude by file type, URL pattern, domain, keyword, or file size (glob or regex)
- **JavaScript Rendering** — Optional Playwright engine for JS-heavy sites
- **Site Auth** — Cookie injection for login-protected sites
- **Offline Rewriting** — Rewrite HTML links for offline browsing
- **Duplicate Detection** — SHA256 comparison prevents re-downloading
- **Scheduling** — Cron-based automatic re-crawling via Celery Beat
- **Real-time Progress** — WebSocket updates for crawl progress and file discovery

## API Endpoints

All endpoints are under `/api/grabber/` and require JWT authentication.

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/grabber/projects/` | List all projects for the authenticated user |
| POST | `/api/grabber/projects/` | Create a new grabber project |
| GET | `/api/grabber/projects/{id}/` | Project detail |
| PATCH | `/api/grabber/projects/{id}/` | Update project settings |
| DELETE | `/api/grabber/projects/{id}/` | Delete project |
| POST | `/api/grabber/projects/{id}/start/` | Start crawling |
| POST | `/api/grabber/projects/{id}/stop/` | Stop crawling |
| POST | `/api/grabber/projects/{id}/pause/` | Pause crawling |
| POST | `/api/grabber/projects/{id}/resume/` | Resume crawling |
| GET | `/api/grabber/projects/{id}/stats/` | Project statistics |

### Discovered Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/grabber/projects/{id}/files/` | List discovered files (filterable by `file_type`, `status`, `search`) |
| DELETE | `/api/grabber/projects/{id}/files/{file_id}/` | Delete a discovered file |
| POST | `/api/grabber/projects/{id}/files/{file_id}/download/` | Queue single file for download |
| POST | `/api/grabber/projects/{id}/files/download-bulk/` | Queue multiple files for download |

### Filters

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/grabber/projects/{id}/filters/` | List filters |
| POST | `/api/grabber/projects/{id}/filters/` | Add a filter |
| DELETE | `/api/grabber/projects/{id}/filters/{filter_id}/` | Delete a filter |

### Crawl Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/grabber/projects/{id}/tasks/` | List crawl tasks (tree structure) |

## Project Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | required | Human-readable project name |
| `start_url` | URL | required | The URL to start crawling from |
| `max_depth` | integer | 3 | Maximum crawl depth (0-10) |
| `max_pages` | integer | 500 | Maximum pages to crawl |
| `max_files` | integer | 2000 | Maximum files to discover |
| `concurrency` | integer | 3 | Max concurrent crawl requests |
| `crawl_delay` | float | 1.0 | Seconds between requests (rate limiting) |
| `respect_robots_txt` | bool | true | Honor robots.txt directives |
| `user_agent` | string | AIO-Grabber/1.0 | User agent for requests |
| `use_javascript` | bool | false | Enable Playwright JS rendering |
| `rewrite_links` | bool | false | Rewrite links for offline browsing |
| `schedule_cron` | string | "" | Cron expression for scheduled re-crawls |
| `auth_json` | JSON | {} | Authentication config for login-protected sites |

## Filter Engine

Filters support include/exclude rules for:

- **file_type** — Glob pattern for file extensions (e.g., `*.mp4`, `*.pdf`)
- **url** — URL pattern matching
- **domain** — Domain matching
- **keyword** — Substring match against URL
- **file_size** — Numeric comparison (exact match for single number)

Filters can use glob patterns or regex (`is_regex: true`).

## Crawl Engine

The crawler uses `httpx` for async HTTP requests and `BeautifulSoup` for HTML parsing by default. When `use_javascript` is enabled, it falls back to `playwright` for pages that require JavaScript rendering.

### Link Discovery

- `<a href>`, `<img src>`, `<video src>`, `<audio src>`, `<source src>`
- `<link href>`, `<script src>`, `<iframe src>`, `<embed src>`
- CSS `url()` references (inline and external stylesheets)
- `<object>` and `<param>` data attributes

### File Type Detection

File types are detected by URL extension and classified as: image, video, audio, document, archive, or other.

## WebSocket Events

Connect to `ws://host/ws/grabber/{project_id}/` for real-time updates:

| Event | Data | Description |
|-------|------|-------------|
| `crawl_started` | `project_id` | Crawl has begun |
| `crawl_progress` | `pages_crawled`, `files_discovered`, `pending_tasks` | Progress update |
| `crawl_completed` | `project_id`, `pages_crawled`, `files_discovered` | Crawl finished |
| `crawl_error` | `project_id`, `error` | Crawl encountered an error |
| `crawl_stopped` | `project_id` | Crawl was stopped |
| `crawl_paused` | `project_id` | Crawl was paused |
| `file_discovered` | `file_id`, `file_name`, `file_type`, `total_discovered` | A new file was found |
| `file_queued` | `file_id`, `download_job_id` | A file was queued for download |

## Download Integration

When a discovered file is queued for download, it creates a standard `DownloadJob` record. This means:

- Downloads appear in the **Queue** page
- Progress is tracked in real-time
- Completed downloads appear in **History**
- **Telegram** and **Google Drive** integrations work automatically
- Downloaded files are stored in the same media storage (`MEDIA_ROOT/<user_uuid>/grabber/`)

## Celery Tasks

| Task | Schedule | Description |
|------|----------|-------------|
| `crawl_project_task` | On demand | Main crawl task |
| `queue_file_download_task` | On demand | Queue single file download |
| `queue_bulk_download_task` | On demand | Queue multiple files |
| `cleanup_stale_crawls` | Hourly | Mark projects stuck in crawling state as error |
| `cleanup_expired_grabber_files` | Daily | Remove discovered files older than 30 days |
| `scheduled_recrawl` | Per project cron | Re-crawl a project on schedule |

## Site Accounts (Sites Manager)

The Sites Manager stores website authentication credentials used by the Grabber for sites that require login.

### API Endpoints

All endpoints are under `/api/grabber/sites/` and require JWT authentication.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/grabber/sites/` | List all site accounts (supports `?search=` filter) |
| POST | `/api/grabber/sites/` | Create a new site account |
| GET | `/api/grabber/sites/{id}/` | Get site account detail |
| PATCH | `/api/grabber/sites/{id}/` | Update site account |
| DELETE | `/api/grabber/sites/{id}/` | Delete site account |

### Supported Authentication Methods

| Method | Description |
|--------|-------------|
| **Cookie Injection** | Provide session cookies for authenticated access |
| **Header Auth** | Custom HTTP headers (e.g., `Authorization: Bearer ...`) |
| **Basic Auth** | HTTP Basic authentication via username/password |
| **Form POST** | Login form submission (requires login URL) |

### SiteAccount Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | required | Human-readable label (e.g. "My Private Forum") |
| `site_url` | URL | required | Base URL of the website |
| `username` | string | "" | Login username or email |
| `password_encrypted` | string | "" | Encrypted password (write-only) |
| `cookies` | JSON | {} | Cookie key/value pairs |
| `headers` | JSON | {} | Custom HTTP headers |
| `login_url` | URL | "" | Login page URL (for form-based auth) |
| `login_method` | enum | "cookie" | Authentication method |
| `notes` | text | "" | Optional notes |
| `is_active` | bool | true | Whether this account is active |

### Usage with Grabber

When creating a Grabber project, set `auth_json` to reference a SiteAccount ID if the target site requires authentication. The Grabber will use the stored credentials when crawling pages on that domain.

## Models

### GrabberProject
- Core project entity with all configuration and crawl state

### GrabberFilter
- Include/exclude rules scoped to a project

### GrabberCrawlTask
- Individual URL crawl records forming a hierarchical tree

### GrabberDiscoveredFile
- Files found during crawling, linked to download jobs
