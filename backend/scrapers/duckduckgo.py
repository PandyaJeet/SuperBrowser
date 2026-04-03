from urllib.parse import parse_qs, urlparse

import httpx
from bs4 import BeautifulSoup


async def scrape_duckduckgo(query: str) -> list[dict]:
    """Scrape DuckDuckGo HTML search results."""
    url = "https://html.duckduckgo.com/html/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(url, params={"q": query}, headers=headers)
            response.raise_for_status()
    except (httpx.RequestError, httpx.HTTPStatusError):
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    results = []

    for result_div in soup.select("div.result"):
        # Skip ads
        if "result--ad" in result_div.get("class", []):
            continue

        # Extract title and URL
        title_link = result_div.select_one("h2.result__title a")
        if not title_link:
            continue

        title = title_link.get_text(strip=True)
        raw_url = title_link.get("href", "")

        # Extract actual URL from uddg= query param if present
        parsed = urlparse(raw_url)
        query_params = parse_qs(parsed.query)
        if "uddg" in query_params:
            actual_url = query_params["uddg"][0]
        else:
            actual_url = raw_url

        # Extract snippet
        snippet_elem = result_div.select_one("a.result__snippet")
        snippet = snippet_elem.get_text(strip=True) if snippet_elem else ""

        results.append({
            "title": title,
            "url": actual_url,
            "snippet": snippet,
            "source": "duckduckgo"
        })

        if len(results) >= 10:
            break

    return results
