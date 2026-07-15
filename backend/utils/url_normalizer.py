# backend/utils/url_normalizer.py
"""
URL normalization utility for deduplication of search results.
Two URLs that represent the same page should produce the same normalized form.
"""

from urllib.parse import urlparse, urlunparse, urlencode, parse_qsl
import re

# Tracking/UTM parameters that should be stripped — these don't change the page content
TRACKING_PARAMS = frozenset({
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'fbclid', 'gclid', 'msclkid', 'ref', 'source', 'mc_cid', 'mc_eid',
})


def normalize_url(url: str) -> str:
    """
    Normalize a URL for deduplication purposes.

    What this does:
    - Lowercases the entire URL (so /Article == /article)
    - Removes tracking params like utm_source, fbclid
    - Removes trailing slashes from the path
    - Removes www. prefix from domains
    - Removes the URL fragment (the #section part)
    - Sorts remaining query params so ?b=2&a=1 == ?a=1&b=2

    Returns the original URL unchanged if parsing fails.
    """
    try:
        parsed = urlparse(url.strip().lower())

        # Remove tracking query parameters, keep everything else
        filtered_params = [
            (k, v) for k, v in parse_qsl(parsed.query)
            if k.lower() not in TRACKING_PARAMS
        ]
        # Sort remaining params for a consistent canonical form
        clean_query = urlencode(sorted(filtered_params))

        # Remove trailing slash from path, but keep root '/' intact
        clean_path = parsed.path.rstrip('/') or '/'

        # Remove www. prefix so www.example.com == example.com
        clean_netloc = re.sub(r'^www\.', '', parsed.netloc)

        normalized = urlunparse((
            parsed.scheme,    # http or https
            clean_netloc,     # domain without www
            clean_path,       # path without trailing slash
            parsed.params,    # rarely used, keep as-is
            clean_query,      # cleaned query string
            ''                # strip fragment (#section)
        ))
        return normalized

    except Exception:
        # If anything goes wrong, return the original so we don't crash
        return url


def deduplicate_results(results: list[dict]) -> list[dict]:
    """
    Deduplicate search results using normalized URLs.

    Takes a list of result dicts (each must have a 'url' key).
    Returns a new list with duplicate URLs removed.
    First occurrence of each URL is kept (usually highest-ranked).
    """
    seen_normalized = set()
    deduped = []

    for result in results:
        norm = normalize_url(result.get('url', ''))
        if norm not in seen_normalized:
            seen_normalized.add(norm)
            deduped.append(result)

    return deduped