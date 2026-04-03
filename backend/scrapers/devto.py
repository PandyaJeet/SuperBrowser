import httpx


async def scrape_devto(query: str) -> list[dict]:
    """Scrape Dev.to for articles related to query using their public API."""
    results = []

    try:
        async with httpx.AsyncClient() as client:
            headers = {
                "User-Agent": "SuperBrowser/1.0",
                "Accept": "application/json",
            }

            # STEP 1 — Search Dev.to articles
            # Try both tag-based and search-based endpoints
            first_word = query.split()[0].lower() if query.split() else query.lower()

            # Tag-based search
            tag_url = f"https://dev.to/api/articles?per_page=5&tag={first_word}"
            tag_response = await client.get(
                tag_url,
                headers=headers,
                timeout=8,
                follow_redirects=True,
            )

            tag_articles = []
            if tag_response.status_code == 200:
                tag_articles = tag_response.json()

            # Search-based query
            search_url = f"https://dev.to/api/articles?per_page=5&q={query}"
            search_response = await client.get(
                search_url,
                headers=headers,
                timeout=8,
                follow_redirects=True,
            )

            search_articles = []
            if search_response.status_code == 200:
                search_articles = search_response.json()

            # Use whichever returns more results
            articles = tag_articles if len(tag_articles) >= len(search_articles) else search_articles

            if not articles:
                print("[devto] found 0 articles")
                return []

            # STEP 2 — Build result list
            for article in articles:
                try:
                    user = article.get("user", {})
                    results.append({
                        "title": article.get("title", ""),
                        "url": article.get("url", ""),
                        "description": article.get("description", ""),
                        "tags": article.get("tag_list", []),
                        "reactions": article.get("positive_reactions_count", 0),
                        "comments_count": article.get("comments_count", 0),
                        "author": user.get("name", "") if user else "",
                        "reading_time": article.get("reading_time_minutes", 0),
                    })
                except Exception:
                    continue

            print(f"[devto] found {len(results)} articles")
            return results

    except Exception:
        print("[devto] found 0 articles")
        return []
