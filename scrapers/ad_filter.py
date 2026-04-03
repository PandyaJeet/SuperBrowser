from urllib.parse import urlparse

# Ad/spam URL patterns to filter out
AD_PATTERNS = [
    "googleadservices",
    "doubleclick",
    "pagead",
    "/aclk",
    "msclkid",
    "utm_medium=cpc",
    "utm_source=google_cpc",
    "utm_medium=paidsearch",
    "bing.com/aclk",
    "yahoo.com/cbclk",
    "ad.atdmt",
    "tracking.",
    "click.linksynergy",
    "adclick",
]


def is_clean(url: str) -> bool:
    """Returns False if URL contains ad/spam patterns, True otherwise."""
    url_lower = url.lower()
    for pattern in AD_PATTERNS:
        if pattern in url_lower:
            return False
    return True


def extract_domain(url: str) -> str:
    """Extract domain from URL, stripping www. prefix."""
    parsed = urlparse(url)
    domain = parsed.netloc
    if domain.startswith("www."):
        domain = domain[4:]
    return domain


def score_and_rank(sources: list[list[dict]]) -> list[dict]:
    """
    Take results from multiple scrapers and return a clean, ranked, deduplicated list.
    
    Args:
        sources: List of result lists, one per scraper
                 Each result dict has: title, url, snippet, source
    
    Returns:
        Top 10 results with trust_score and cross_validated fields
    """
    # Step 1: Flatten all results
    all_results = []
    for source_list in sources:
        all_results.extend(source_list)
    
    # Step 2: Filter out ad/spam URLs
    clean_results = [r for r in all_results if is_clean(r.get("url", ""))]
    
    # Step 3: Group by domain
    domain_groups: dict[str, list[dict]] = {}
    for result in clean_results:
        domain = extract_domain(result.get("url", ""))
        if domain not in domain_groups:
            domain_groups[domain] = []
        domain_groups[domain].append(result)
    
    # Step 4 & 5: Count unique sources per domain and pick best result
    ranked_results = []
    for domain, results in domain_groups.items():
        # Count unique sources
        unique_sources = set(r.get("source", "") for r in results)
        source_count = len(unique_sources)
        
        # Pick best result (longest snippet)
        best_result = max(results, key=lambda r: len(r.get("snippet", "")))
        
        # Step 6: Attach trust_score
        trust_score = 2 if source_count >= 2 else 1
        cross_validated = source_count >= 2
        
        ranked_results.append({
            "title": best_result.get("title", ""),
            "url": best_result.get("url", ""),
            "snippet": best_result.get("snippet", ""),
            "source": best_result.get("source", ""),
            "trust_score": trust_score,
            "cross_validated": cross_validated,
        })
    
    # Step 7: Sort by trust_score desc, then snippet length desc
    ranked_results.sort(
        key=lambda r: (r["trust_score"], len(r["snippet"])),
        reverse=True
    )
    
    # Step 8: Return top 10
    return ranked_results[:10]
