import html
import xml.etree.ElementTree as ET

import httpx
from bs4 import BeautifulSoup


BING_SEARCH_URL = "https://www.bing.com/search"
MAX_RESULTS = 10


def _extract_bing_html_results(page_html: str) -> list[dict]:
    soup = BeautifulSoup(page_html, "html.parser")
    results: list[dict] = []
    seen_urls: set[str] = set()

    for result_div in soup.select("li.b_algo, div.b_algo"):
        title_link = result_div.select_one("h2 a[href]") or result_div.select_one("a[href]")
        if not title_link:
            continue

        result_url = title_link.get("href", "")
        if not result_url or result_url in seen_urls:
            continue
        if result_url.startswith("#") or result_url.startswith("javascript:"):
            continue

        title = title_link.get_text(" ", strip=True)
        snippet_elem = (
            result_div.select_one("div.b_caption p")
            or result_div.select_one("p.b_lineclamp2")
            or result_div.select_one("p")
        )
        snippet = snippet_elem.get_text(" ", strip=True) if snippet_elem else ""

        if title or result_url:
            results.append({
                "title": title,
                "url": result_url,
                "snippet": snippet,
                "source": "bing",
            })
            seen_urls.add(result_url)

        if len(results) >= MAX_RESULTS:
            break

    return results


def _extract_bing_rss_results(xml_text: str) -> list[dict]:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []

    results: list[dict] = []
    seen_urls: set[str] = set()

    for item in root.findall(".//item"):
        title = (item.findtext("title") or "").strip()
        url = (item.findtext("link") or "").strip()
        raw_description = (item.findtext("description") or "").strip()

        if not url or url in seen_urls:
            continue

        snippet = BeautifulSoup(html.unescape(raw_description), "html.parser").get_text(" ", strip=True)

        results.append({
            "title": title,
            "url": url,
            "snippet": snippet,
            "source": "bing",
        })
        seen_urls.add(url)

        if len(results) >= MAX_RESULTS:
            break

    return results


async def scrape_bing(query: str) -> list[dict]:
    """Scrape Bing web results as a fallback when API search is unavailable."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    page_text = ""
    status = "request_failed"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                BING_SEARCH_URL,
                params={"q": query, "count": "10", "setlang": "en-US"},
                headers=headers,
                follow_redirects=True,
            )
            response.raise_for_status()
            page_text = response.text
            status = str(response.status_code)
    except (httpx.RequestError, httpx.HTTPStatusError):
        pass

    html_results = _extract_bing_html_results(page_text)
    if html_results:
        print(f"[bing] status={status} parser=html results={len(html_results)}")
        return html_results

    # Fallback path: RSS endpoint remains stable when web HTML is JS/captcha-heavy.
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            rss_response = await client.get(
                BING_SEARCH_URL,
                params={"q": query, "format": "rss", "count": "10", "setlang": "en-US"},
                headers=headers,
                follow_redirects=True,
            )
            rss_response.raise_for_status()
    except (httpx.RequestError, httpx.HTTPStatusError):
        print(f"[bing] status={status} parser=none results=0")
        return []

    rss_results = _extract_bing_rss_results(rss_response.text)
    print(f"[bing] status={status} parser=rss results={len(rss_results)}")
    return rss_results
