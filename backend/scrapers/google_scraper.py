from urllib.parse import parse_qs, urlparse

import httpx
from bs4 import BeautifulSoup

from scrapers.brave import scrape_brave


GOOGLE_SEARCH_URL = "https://www.google.com/search"
STARTPAGE_SEARCH_URL = "https://www.startpage.com/sp/search"
MAX_RESULTS = 10


def _extract_google_url(raw_url: str) -> str:
    if not raw_url:
        return ""

    if raw_url.startswith("/url?"):
        parsed = urlparse(raw_url)
        query_params = parse_qs(parsed.query)
        return query_params.get("q", [""])[0]

    return raw_url


def _is_google_block_page(html: str) -> bool:
    text = html.lower()
    markers = [
        "enablejs",
        "about this page",
        "detected unusual traffic",
        "sorry/index",
        "recaptcha",
    ]
    return any(marker in text for marker in markers)


def _is_valid_result_url(url: str) -> bool:
    if not url:
        return False

    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return False

    host = parsed.netloc.lower()
    if not host:
        return False

    # Exclude Google-owned internal URLs from result cards.
    if host.endswith("google.com") or host.endswith("googleadservices.com"):
        return False

    return True


def _extract_google_results(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    results: list[dict] = []
    seen_urls: set[str] = set()

    for result_div in soup.select("div.g, div.MjjYud, div.Gx5Zad"):
        link_elem = result_div.select_one("a[href]")
        if not link_elem:
            continue

        result_url = _extract_google_url(link_elem.get("href", ""))
        if not _is_valid_result_url(result_url) or result_url in seen_urls:
            continue

        h3_elem = result_div.select_one("h3")
        title = h3_elem.get_text(strip=True) if h3_elem else link_elem.get_text(strip=True)

        snippet_elem = (
            result_div.select_one("div[data-sncf]")
            or result_div.select_one("div.VwiC3b")
            or result_div.select_one("span.aCOpRe")
            or result_div.select_one("div.s3v9rd")
        )
        snippet = snippet_elem.get_text(" ", strip=True) if snippet_elem else ""

        if not title and not result_url:
            continue

        results.append({
            "title": title,
            "url": result_url,
            "snippet": snippet,
            "source": "google",
        })
        seen_urls.add(result_url)

        if len(results) >= MAX_RESULTS:
            break

    return results


def _extract_startpage_results(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    results: list[dict] = []
    seen_urls: set[str] = set()

    for result_div in soup.select("div.result"):
        title_link = result_div.select_one("a.result-title.result-link, a[class*=result-title]")
        if not title_link:
            continue

        result_url = title_link.get("href", "")
        if not _is_valid_result_url(result_url) or result_url in seen_urls:
            continue

        title = title_link.get_text(" ", strip=True)
        snippet_elem = result_div.select_one("p.description, p[class*=description]")
        snippet = snippet_elem.get_text(" ", strip=True) if snippet_elem else ""

        results.append({
            "title": title,
            "url": result_url,
            "snippet": snippet,
            "source": "google",
        })
        seen_urls.add(result_url)

        if len(results) >= MAX_RESULTS:
            break

    return results


async def scrape_google(query: str) -> list[dict]:
    """Scrape Google-like web results with resilient fallback parsing."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    google_results: list[dict] = []
    google_status = "request_failed"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                GOOGLE_SEARCH_URL,
                params={"q": query, "num": "10", "hl": "en"},
                headers=headers,
                follow_redirects=True,
            )
            response.raise_for_status()
            google_status = str(response.status_code)

            if not _is_google_block_page(response.text):
                google_results = _extract_google_results(response.text)

            if google_results:
                print(f"[google] status={google_status} parser=google results={len(google_results)}")
                return google_results
    except (httpx.RequestError, httpx.HTTPStatusError):
        pass

    # Fallback path: Startpage provides static HTML results in bot-heavy environments.
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            fallback_response = await client.get(
                STARTPAGE_SEARCH_URL,
                params={"query": query, "language": "english"},
                headers=headers,
                follow_redirects=True,
            )
            fallback_response.raise_for_status()
    except (httpx.RequestError, httpx.HTTPStatusError):
        print(f"[google] status={google_status} parser=none results=0")
        return []

    fallback_results = _extract_startpage_results(fallback_response.text)
    if fallback_results:
        print(f"[google] status={google_status} parser=startpage results={len(fallback_results)}")
        return fallback_results

    # Final fallback path: use Brave web scraping and map into Google source shape.
    try:
        brave_results = await scrape_brave(query)
    except Exception:
        brave_results = []

    bridged_results: list[dict] = []
    seen_urls: set[str] = set()
    for item in brave_results:
        result_url = item.get("url", "")
        if not _is_valid_result_url(result_url) or result_url in seen_urls:
            continue

        bridged_results.append({
            "title": item.get("title", ""),
            "url": result_url,
            "snippet": item.get("snippet", ""),
            "source": "google",
        })
        seen_urls.add(result_url)

        if len(bridged_results) >= MAX_RESULTS:
            break

    print(f"[google] status={google_status} parser=brave_bridge results={len(bridged_results)}")
    return bridged_results
