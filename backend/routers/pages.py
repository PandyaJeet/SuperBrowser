from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()


def _validate_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Only http and https URLs are supported")
    return url


def _clean_text(value: str | None) -> str:
    return " ".join((value or "").split())


def _extract_preview(html: str, source_url: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "iframe", "form"]):
        tag.decompose()

    title = _clean_text(
        (soup.find("meta", property="og:title") or {}).get("content")
        or (soup.title.string if soup.title else "")
    )
    description = _clean_text(
        (soup.find("meta", attrs={"name": "description"}) or {}).get("content")
        or (soup.find("meta", property="og:description") or {}).get("content")
    )

    content_root = (
        soup.find("article")
        or soup.find("main")
        or soup.find(attrs={"role": "main"})
        or soup.body
        or soup
    )
    paragraphs = []
    for node in content_root.find_all(["h1", "h2", "h3", "p", "li"], limit=120):
        text = _clean_text(node.get_text(" ", strip=True))
        if len(text) < 35 and node.name not in {"h1", "h2", "h3"}:
            continue
        if text and text not in paragraphs:
            paragraphs.append(text)
        if len(" ".join(paragraphs)) > 8000:
            break

    return {
        "url": source_url,
        "title": title or source_url,
        "description": description,
        "content": paragraphs,
    }


@router.get("/page/preview")
async def page_preview(url: str = Query(..., min_length=8)):
    target_url = _validate_url(url)
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=httpx.Timeout(8.0, connect=4.0),
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0 Safari/537.36 SuperBrowser/1.0"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        ) as client:
            response = await client.get(target_url)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not load page preview: {exc}") from exc

    content_type = response.headers.get("content-type", "")
    if "text/html" not in content_type and "application/xhtml" not in content_type:
        raise HTTPException(status_code=415, detail="This URL is not an HTML page")

    return _extract_preview(response.text, str(response.url))
