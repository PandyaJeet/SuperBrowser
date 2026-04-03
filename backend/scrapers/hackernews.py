import asyncio

import httpx
from bs4 import BeautifulSoup


async def scrape_hackernews(query: str) -> list[dict]:
    """Scrape Hacker News for stories and comments related to query using Algolia API."""
    results = []

    try:
        async with httpx.AsyncClient() as client:
            headers = {"User-Agent": "SuperBrowser/1.0"}

            # STEP 1 — Search HN via Algolia
            search_url = f"https://hn.algolia.com/api/v1/search?query={query}&tags=story&hitsPerPage=5"
            response = await client.get(
                search_url,
                headers=headers,
                timeout=8,
                follow_redirects=True,
            )
            response.raise_for_status()
            search_data = response.json()

            hits = search_data.get("hits", [])
            if not hits:
                print("[hackernews] found 0 stories")
                return []

            # Build story list
            stories = []
            for hit in hits:
                story_id = hit.get("objectID", "")
                title = hit.get("title", "")
                url = hit.get("url", f"https://news.ycombinator.com/item?id={story_id}")
                score = hit.get("points", 0)
                num_comments = hit.get("num_comments", 0)
                hn_link = f"https://news.ycombinator.com/item?id={story_id}"
                author = hit.get("author", "")

                stories.append({
                    "story_id": story_id,
                    "title": title,
                    "url": url,
                    "hn_link": hn_link,
                    "score": score,
                    "num_comments": num_comments,
                    "author": author,
                })

            # STEP 2 — Fetch top comments for each story in parallel
            async def fetch_comments(story: dict) -> dict:
                try:
                    item_url = f"https://hn.algolia.com/api/v1/items/{story['story_id']}"
                    response = await client.get(
                        item_url,
                        headers=headers,
                        timeout=8,
                        follow_redirects=True,
                    )
                    response.raise_for_status()
                    item_data = response.json()

                    children = item_data.get("children", [])
                    comments = []

                    for child in children:
                        text = child.get("text")
                        if not text:
                            continue

                        # Strip HTML from text
                        soup = BeautifulSoup(text, "html.parser")
                        clean_text = soup.get_text(separator=" ").strip()

                        if not clean_text:
                            continue

                        comments.append({
                            "author": child.get("author", ""),
                            "text": clean_text,
                            "points": child.get("points") or 0,
                        })

                    # Sort by points descending, take top 3
                    comments.sort(key=lambda c: c["points"], reverse=True)
                    top_comments = comments[:3]

                    return {
                        "title": story["title"],
                        "url": story["url"],
                        "hn_link": story["hn_link"],
                        "score": story["score"],
                        "num_comments": story["num_comments"],
                        "author": story["author"],
                        "top_comments": top_comments,
                    }

                except Exception:
                    return {
                        "title": story["title"],
                        "url": story["url"],
                        "hn_link": story["hn_link"],
                        "score": story["score"],
                        "num_comments": story["num_comments"],
                        "author": story["author"],
                        "top_comments": [],
                    }

            # Run all comment fetches in parallel
            results = await asyncio.gather(*[fetch_comments(s) for s in stories])

            print(f"[hackernews] found {len(results)} stories")
            return list(results)

    except Exception:
        print("[hackernews] found 0 stories")
        return []
