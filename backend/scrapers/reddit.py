import asyncio
from urllib.parse import parse_qs, urlparse

import httpx
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}


async def fetch_thread(client: httpx.AsyncClient, thread_url: str) -> dict | None:
    """Fetch a single Reddit thread as JSON and extract post + comments."""
    # Convert URL to JSON endpoint
    json_url = thread_url.rstrip("/") + ".json"

    try:
        response = await client.get(
            json_url,
            headers={**HEADERS, "Accept": "application/json"},
            follow_redirects=True,
        )
        response.raise_for_status()
        data = response.json()
    except (httpx.RequestError, httpx.HTTPStatusError, ValueError):
        # Reddit blocked - return None
        return None

    try:
        # Extract post data
        post_data = data[0]["data"]["children"][0]["data"]
        title = post_data.get("title", "")
        subreddit = post_data.get("subreddit", "")
        post_score = post_data.get("score", 0)
        num_comments = post_data.get("num_comments", 0)

        # Extract comments
        comments = []
        for child in data[1]["data"]["children"]:
            if child.get("kind") != "t1":
                continue
            comment_data = child.get("data", {})
            body = comment_data.get("body", "")
            if body in ("[deleted]", "[removed]"):
                continue
            comments.append({
                "author": comment_data.get("author", ""),
                "body": body,
                "score": comment_data.get("score", 0),
            })

        # Sort by score descending, take top 3
        comments.sort(key=lambda c: c["score"], reverse=True)
        top_comments = comments[:3]

        return {
            "title": title,
            "url": thread_url,
            "subreddit": subreddit,
            "post_score": post_score,
            "num_comments": num_comments,
            "top_comments": top_comments,
        }

    except (KeyError, IndexError, TypeError):
        return None


def extract_info_from_url(url: str) -> dict:
    """Extract subreddit and partial title from Reddit URL when API is blocked."""
    # URL format: https://reddit.com/r/{subreddit}/comments/{id}/{title_slug}/
    parts = url.split("/")
    subreddit = ""
    title_slug = ""

    for i, part in enumerate(parts):
        if part == "r" and i + 1 < len(parts):
            subreddit = parts[i + 1]
        if part == "comments" and i + 2 < len(parts):
            title_slug = parts[i + 2]

    # Convert slug to readable title
    title = title_slug.replace("_", " ").replace("-", " ").title() if title_slug else "Reddit Discussion"

    return {
        "title": title,
        "url": url,
        "subreddit": subreddit,
        "post_score": 0,
        "num_comments": 0,
        "top_comments": [],
    }


async def find_reddit_urls_via_ddg(client: httpx.AsyncClient, query: str) -> list[str]:
    """Use DuckDuckGo HTML search to find Reddit thread URLs."""
    url = "https://html.duckduckgo.com/html/"

    try:
        response = await client.get(
            url,
            params={"q": f"reddit {query}"},
            headers=HEADERS,
            follow_redirects=True,
        )
        response.raise_for_status()
    except (httpx.RequestError, httpx.HTTPStatusError):
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    reddit_urls = []
    seen = set()

    # Look for result links
    for result in soup.select("div.result"):
        # Check result__a which contains the main link
        link = result.select_one("a.result__a")
        if not link:
            continue

        href = link.get("href", "")

        # Extract actual URL from DuckDuckGo's uddg= wrapper
        if "uddg=" in href:
            parsed = urlparse(href)
            query_params = parse_qs(parsed.query)
            if "uddg" in query_params:
                href = query_params["uddg"][0]

        # Filter for Reddit thread URLs
        if "reddit.com/r/" in href and "/comments/" in href:
            # Normalize URL
            if href.startswith("//"):
                href = "https:" + href

            if href not in seen:
                seen.add(href)
                reddit_urls.append(href)

            if len(reddit_urls) >= 4:
                break

    return reddit_urls


async def scrape_reddit(query: str) -> list[dict]:
    """Scrape Reddit for posts and top comments related to query."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Step 1: Find Reddit URLs via DuckDuckGo
            reddit_urls = await find_reddit_urls_via_ddg(client, query)

            print(f"[reddit] found {len(reddit_urls)} thread URLs via DuckDuckGo")

            if not reddit_urls:
                return []

            # Step 2: Fetch each thread as JSON in parallel
            fetch_tasks = [fetch_thread(client, url) for url in reddit_urls]
            results = await asyncio.gather(*fetch_tasks)

            # Step 3: For any failed fetches, use URL-based info as fallback
            posts = []
            for i, result in enumerate(results):
                if result is not None:
                    posts.append(result)
                else:
                    # Fallback: extract info from URL when Reddit blocks us
                    posts.append(extract_info_from_url(reddit_urls[i]))

            print(f"[reddit] successfully processed {len(posts)} posts")
            return posts

    except (httpx.RequestError, httpx.HTTPStatusError, ValueError):
        return []
