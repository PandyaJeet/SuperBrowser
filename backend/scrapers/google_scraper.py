from urllib.parse import parse_qs, urlparse

import httpx
from bs4 import BeautifulSoup


async def scrape_google(query: str) -> list[dict]:
    """Scrape Google search results."""
    url = "https://www.google.com/search"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                url,
                params={"q": query, "num": "10", "hl": "en"},
                headers=headers,
                follow_redirects=True,
            )
            response.raise_for_status()
    except (httpx.RequestError, httpx.HTTPStatusError):
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    results = []

    # Find all divs with id starting with "rso"
    rso_divs = soup.find_all("div", id=lambda x: x and x.startswith("rso"))

    for rso in rso_divs:
        for result_div in rso.select("div.g"):
            # Skip ads
            if result_div.get("data-text-ad"):
                continue

            classes = result_div.get("class", [])
            if "commercial-unit" in classes:
                continue

            # Check parents for ad indicators
            is_ad = False
            for parent in result_div.parents:
                parent_classes = parent.get("class", [])
                if "commercial-unit" in parent_classes or parent.get("data-text-ad"):
                    is_ad = True
                    break
            if is_ad:
                continue

            # Extract title
            h3_elem = result_div.select_one("h3")
            title = h3_elem.get_text(strip=True) if h3_elem else ""

            # Extract URL
            link_elem = result_div.select_one("a")
            raw_url = link_elem.get("href", "") if link_elem else ""

            # Google wraps URLs - extract actual URL from q= param if needed
            if raw_url.startswith("/url?q="):
                parsed = urlparse(raw_url)
                query_params = parse_qs(parsed.query)
                if "q" in query_params:
                    raw_url = query_params["q"][0]

            # Extract snippet - try multiple selectors
            snippet = ""
            snippet_elem = (
                result_div.select_one("div[data-sncf]")
                or result_div.select_one("div.VwiC3b")
                or result_div.select_one("span.aCOpRe")
            )
            if snippet_elem:
                snippet = snippet_elem.get_text(strip=True)

            if title or raw_url:
                results.append({
                    "title": title,
                    "url": raw_url,
                    "snippet": snippet,
                    "source": "google"
                })

            if len(results) >= 10:
                break

        if len(results) >= 10:
            break

    print(f"[google] status={response.status_code} results={len(results)}")
    return results
