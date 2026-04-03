import asyncio
import random
from urllib.parse import parse_qs, urlparse

import httpx
from bs4 import BeautifulSoup


async def scrape_reddit(query: str) -> list[dict]:
    """Scrape Reddit for posts and top comments related to query using DuckDuckGo and old.reddit.com."""
    results = []

    try:
        async with httpx.AsyncClient() as client:
            # STEP 1 — Find Reddit threads via DuckDuckGo with delay
            await asyncio.sleep(random.uniform(1.0, 2.5))

            search_url = f"https://html.duckduckgo.com/html/?q=site:reddit.com+{query}"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://duckduckgo.com/",
            }

            response = await client.get(
                search_url,
                headers=headers,
                timeout=12,
                follow_redirects=True,
            )
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")

            # Find all <a> tags with class "result__url" or "result__a"
            reddit_urls = []
            seen = set()

            for link in soup.find_all("a", class_=["result__url", "result__a"]):
                href = link.get("href", "")

                # Clean uddg= wrapped URLs
                if "uddg=" in href:
                    parsed = urlparse(href)
                    query_params = parse_qs(parsed.query)
                    if "uddg" in query_params:
                        href = query_params["uddg"][0]

                # Filter for Reddit thread URLs
                if "reddit.com/r/" in href and "/comments/" in href:
                    if href.startswith("//"):
                        href = "https:" + href

                    if href not in seen:
                        seen.add(href)
                        reddit_urls.append(href)

                    if len(reddit_urls) >= 4:
                        break

            if not reddit_urls:
                print("[reddit] found 0 threads")
                return []

            # STEP 2 — Fetch each thread as JSON (sequentially to avoid rate limiting)
            json_headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/json, text/html",
            }

            for original_url in reddit_urls:
                try:
                    # Add delay before each request
                    await asyncio.sleep(random.uniform(0.5, 1.0))

                    # Replace with old.reddit.com and append .json
                    json_url = original_url.replace("www.reddit.com", "old.reddit.com")
                    json_url = json_url.replace("reddit.com", "old.reddit.com")
                    json_url = json_url.rstrip("/") + ".json"

                    response = await client.get(
                        json_url,
                        headers=json_headers,
                        timeout=10,
                        follow_redirects=True,
                    )
                    response.raise_for_status()
                    data = response.json()

                    # Parse post data
                    post_data = data[0]["data"]["children"][0]["data"]
                    title = post_data.get("title", "")
                    subreddit = post_data.get("subreddit", "")
                    post_score = post_data.get("score", 0)
                    num_comments = post_data.get("num_comments", 0)

                    # Parse comments
                    comments = []
                    for child in data[1]["data"]["children"]:
                        if child.get("kind") != "t1":
                            continue
                        comment_data = child.get("data", {})
                        body = comment_data.get("body", "")
                        author = comment_data.get("author", "")
                        score = comment_data.get("score", 0)

                        if body in ("[deleted]", "[removed]"):
                            continue

                        comments.append({
                            "author": author,
                            "body": body,
                            "score": score,
                        })

                    # Sort by score descending, take top 3
                    comments.sort(key=lambda c: c["score"], reverse=True)
                    top_comments = comments[:3]

                    results.append({
                        "title": title,
                        "url": original_url,
                        "subreddit": subreddit,
                        "post_score": post_score,
                        "num_comments": num_comments,
                        "top_comments": top_comments,
                    })

                except Exception:
                    # Skip this URL silently on JSON parsing failure
                    continue

            print(f"[reddit] found {len(results)} threads")
            return results

    except Exception:
        print("[reddit] found 0 threads")
        return []
