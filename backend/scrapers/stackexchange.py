import asyncio

import httpx
from bs4 import BeautifulSoup

HEADERS = {"Accept-Encoding": "gzip"}


def strip_html(html: str) -> str:
    """Strip HTML tags and return plain text."""
    soup = BeautifulSoup(html, "html.parser")
    return soup.get_text(separator=" ", strip=True)


async def fetch_top_answer(
    client: httpx.AsyncClient, question_id: int
) -> dict | None:
    """Fetch the top answer for a question."""
    url = f"https://api.stackexchange.com/2.3/questions/{question_id}/answers"
    params = {
        "order": "desc",
        "sort": "votes",
        "site": "stackoverflow",
        "pagesize": 1,
        "filter": "withbody",
    }

    try:
        response = await client.get(
            url, params=params, headers=HEADERS, follow_redirects=True
        )
        response.raise_for_status()
        data = response.json()
    except (httpx.RequestError, httpx.HTTPStatusError, ValueError):
        return None

    items = data.get("items", [])
    if not items:
        return None

    answer = items[0]
    body_html = answer.get("body", "")
    body_text = strip_html(body_html)[:500]

    return {
        "answer_body": body_text,
        "answer_score": answer.get("score", 0),
        "is_accepted": answer.get("is_accepted", False),
    }


async def scrape_stackexchange(query: str) -> list[dict]:
    """Scrape StackOverflow for questions and answers related to query."""
    search_url = "https://api.stackexchange.com/2.3/search/advanced"
    params = {
        "order": "desc",
        "sort": "relevance",
        "q": query,
        "site": "stackoverflow",
        "pagesize": 5,
        "filter": "withbody",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Step 1: Search for questions
            response = await client.get(
                search_url, params=params, headers=HEADERS, follow_redirects=True
            )
            response.raise_for_status()
            data = response.json()

            items = data.get("items", [])
            print(f"[stackexchange] found {len(items)} questions")

            if not items:
                return []

            # Step 2: Parse questions
            questions = []
            for item in items:
                body_html = item.get("body", "")
                body_text = strip_html(body_html)[:300]

                questions.append({
                    "question_id": item.get("question_id"),
                    "title": item.get("title", ""),
                    "link": item.get("link", ""),
                    "score": item.get("score", 0),
                    "is_answered": item.get("is_answered", False),
                    "tags": item.get("tags", []),
                    "question_body": body_text,
                })

            # Step 3: Fetch top answers in parallel
            answer_tasks = [
                fetch_top_answer(client, q["question_id"]) for q in questions
            ]
            answers = await asyncio.gather(*answer_tasks)

            # Step 4: Assemble results
            results = []
            for question, answer in zip(questions, answers):
                result = {
                    "title": question["title"],
                    "link": question["link"],
                    "score": question["score"],
                    "is_answered": question["is_answered"],
                    "tags": question["tags"],
                    "question_body": question["question_body"],
                    "answer_body": answer["answer_body"] if answer else None,
                    "answer_score": answer["answer_score"] if answer else None,
                    "is_accepted": answer["is_accepted"] if answer else None,
                }
                results.append(result)

            return results

    except (httpx.RequestError, httpx.HTTPStatusError, ValueError):
        return []
