import asyncio
import re
from urllib.parse import parse_qs, urlparse

import httpx
from bs4 import BeautifulSoup


DDG_SEARCH_URL = "https://html.duckduckgo.com/html/"
OLD_REDDIT_SEARCH_URL = "https://old.reddit.com/search"
MAX_THREADS = 5
MAX_TOP_COMMENTS = 3


SEARCH_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def _parse_compact_number(value: str) -> int:
    text = (value or "").strip().lower().replace(",", "")
    if not text or text in {"•", "score hidden", "[score hidden]"}:
        return 0

    match = re.search(r"(\d+(?:\.\d+)?)\s*([km]?)", text)
    if not match:
        return 0

    number = float(match.group(1))
    suffix = match.group(2)
    if suffix == "k":
        number *= 1000
    elif suffix == "m":
        number *= 1_000_000

    return int(number)


def _extract_ddg_target_url(href: str) -> str:
    if not href:
        return ""

    if href.startswith("//"):
        href = "https:" + href

    # DDG often wraps real URLs in uddg= query parameter.
    if "uddg=" in href:
        parsed = urlparse(href)
        query_params = parse_qs(parsed.query)
        if "uddg" in query_params and query_params["uddg"]:
            return query_params["uddg"][0]

    return href


def _is_reddit_thread_url(url: str) -> bool:
    if not url:
        return False

    parsed = urlparse(url)
    host = parsed.netloc.lower()
    path = parsed.path.lower()

    is_reddit_host = "reddit.com" in host
    is_thread_path = "/r/" in path and "/comments/" in path
    return is_reddit_host and is_thread_path


def _canonical_thread_url(url: str) -> str:
    parsed = urlparse(url)
    path = parsed.path.rstrip("/")
    return f"https://www.reddit.com{path}"


def _to_old_reddit_url(url: str) -> str:
    parsed = urlparse(url)
    path = parsed.path.rstrip("/")
    if not path:
        return ""
    query = parsed.query
    return f"https://old.reddit.com{path}" + (f"?{query}" if query else "")


def _extract_subreddit_from_url(thread_url: str) -> str:
    parsed = urlparse(thread_url)
    match = re.search(r"/r/([^/]+)/comments/", parsed.path, flags=re.IGNORECASE)
    return match.group(1) if match else ""


def _extract_thread_urls_from_ddg(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    urls: list[str] = []
    seen: set[str] = set()

    for link in soup.select("a.result__a, a.result__url"):
        target = _extract_ddg_target_url(link.get("href", ""))
        if not _is_reddit_thread_url(target):
            continue

        canonical = _canonical_thread_url(target)
        if canonical in seen:
            continue

        seen.add(canonical)
        urls.append(canonical)

        if len(urls) >= MAX_THREADS:
            break

    return urls


def _extract_thread_urls_from_old_search(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    urls: list[str] = []
    seen: set[str] = set()

    for link in soup.select("a.search-title[href], a.title[href]"):
        href = link.get("href", "")
        if not _is_reddit_thread_url(href):
            continue

        canonical = _canonical_thread_url(href)
        if canonical in seen:
            continue

        seen.add(canonical)
        urls.append(canonical)

        if len(urls) >= MAX_THREADS:
            break

    return urls


def _parse_thread_page(html: str, thread_url: str) -> dict | None:
    soup = BeautifulSoup(html, "html.parser")

    post = soup.select_one("div.thing.link")
    if not post:
        return None

    title_elem = post.select_one("a.title")
    title = title_elem.get_text(" ", strip=True) if title_elem else ""

    subreddit_elem = post.select_one("a.subreddit")
    subreddit = subreddit_elem.get_text("", strip=True).replace("r/", "") if subreddit_elem else ""
    if not subreddit:
        subreddit = _extract_subreddit_from_url(thread_url)

    score_elem = post.select_one("div.score.unvoted, span.score.unvoted")
    score_text = ""
    if score_elem:
        score_text = score_elem.get("title", "") or score_elem.get_text(" ", strip=True)
    post_score = _parse_compact_number(score_text)

    comments_link = post.select_one("a.comments")
    comments_text = comments_link.get_text(" ", strip=True) if comments_link else ""
    num_comments = _parse_compact_number(comments_text)

    comments: list[dict] = []
    for comment_div in soup.select("div.comment"):
        classes = set(comment_div.get("class", []))
        if "deleted" in classes or "removed" in classes or "morechildren" in classes:
            continue

        body_elem = comment_div.select_one("div.usertext-body div.md")
        if not body_elem:
            continue

        body = body_elem.get_text(" ", strip=True)
        if not body or body in {"[deleted]", "[removed]"}:
            continue

        author_elem = comment_div.select_one("a.author")
        author = author_elem.get_text("", strip=True) if author_elem else "[deleted]"

        comment_score_elem = comment_div.select_one("span.score.unvoted")
        comment_score_text = ""
        if comment_score_elem:
            comment_score_text = comment_score_elem.get("title", "") or comment_score_elem.get_text(" ", strip=True)
        comment_score = _parse_compact_number(comment_score_text)

        comments.append({
            "author": author,
            "body": body,
            "score": comment_score,
        })

    comments.sort(key=lambda c: c["score"], reverse=True)
    top_comments = comments[:MAX_TOP_COMMENTS]

    if num_comments == 0:
        num_comments = len(comments)

    return {
        "title": title,
        "url": thread_url,
        "subreddit": subreddit,
        "post_score": post_score,
        "num_comments": num_comments,
        "top_comments": top_comments,
    }


async def _discover_thread_urls(client: httpx.AsyncClient, query: str) -> list[str]:
    # Primary discovery: DuckDuckGo HTML search.
    try:
        ddg_response = await client.get(
            DDG_SEARCH_URL,
            params={"q": f"site:reddit.com {query}"},
            headers=SEARCH_HEADERS,
            timeout=12,
            follow_redirects=True,
        )
        ddg_response.raise_for_status()
        urls = _extract_thread_urls_from_ddg(ddg_response.text)
        if urls:
            return urls
    except Exception:
        pass

    # Secondary discovery fallback: old.reddit search page.
    try:
        fallback_response = await client.get(
            OLD_REDDIT_SEARCH_URL,
            params={"q": query, "sort": "relevance", "t": "all"},
            headers=SEARCH_HEADERS,
            timeout=12,
            follow_redirects=True,
        )
        fallback_response.raise_for_status()
        return _extract_thread_urls_from_old_search(fallback_response.text)
    except Exception:
        return []


async def scrape_reddit(query: str) -> list[dict]:
    """Scrape Reddit threads and comments using HTML endpoints only (no Reddit API)."""
    try:
        async with httpx.AsyncClient() as client:
            thread_urls = await _discover_thread_urls(client, query)
            if not thread_urls:
                print("[reddit] found 0 threads")
                return []

            semaphore = asyncio.Semaphore(3)

            async def fetch_thread(thread_url: str) -> dict | None:
                async with semaphore:
                    try:
                        await asyncio.sleep(0.2)
                        response = await client.get(
                            _to_old_reddit_url(thread_url),
                            headers=SEARCH_HEADERS,
                            timeout=12,
                            follow_redirects=True,
                        )
                        response.raise_for_status()
                        return _parse_thread_page(response.text, thread_url)
                    except Exception:
                        return None

            parsed_threads = await asyncio.gather(*[fetch_thread(url) for url in thread_urls])
            results = [thread for thread in parsed_threads if thread]

            print(f"[reddit] found {len(results)} threads")
            return results

    except Exception:
        print("[reddit] found 0 threads")
        return []
