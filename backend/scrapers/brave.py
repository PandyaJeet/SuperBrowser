import httpx
from bs4 import BeautifulSoup


async def scrape_brave(query: str) -> list[dict]:
    """Scrape Brave search results."""
    url = "https://search.brave.com/search"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                url,
                params={"q": query, "source": "web"},
                headers=headers,
                follow_redirects=True,
            )
            response.raise_for_status()
    except (httpx.RequestError, httpx.HTTPStatusError):
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    results = []

    for snippet_div in soup.select("div.snippet[data-type=web]"):
        # Skip ads
        classes = snippet_div.get("class", [])
        if "is-ad" in classes or "is_ad" in classes:
            continue

        # Check parents for ad classes
        is_ad = False
        for parent in snippet_div.parents:
            parent_classes = parent.get("class", [])
            if "is-ad" in parent_classes or "is_ad" in parent_classes:
                is_ad = True
                break
        if is_ad:
            continue

        # Extract title - try .title class first
        title_elem = snippet_div.select_one(".title")
        title = title_elem.get_text(strip=True) if title_elem else ""

        # Extract URL from first anchor with href
        link_elem = snippet_div.select_one("a[href]")
        result_url = link_elem.get("href", "") if link_elem else ""

        # Extract snippet description
        desc_elem = snippet_div.select_one(".description")
        snippet = desc_elem.get_text(strip=True) if desc_elem else ""

        if title or result_url:
            results.append({
                "title": title,
                "url": result_url,
                "snippet": snippet,
                "source": "brave"
            })

        if len(results) >= 10:
            break

    print(f"[brave] status={response.status_code} results={len(results)}")
    return results
