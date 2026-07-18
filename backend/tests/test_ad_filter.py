from scrapers.ad_filter import is_clean, extract_domain, score_and_rank


def test_is_clean_flags_ad_urls():
    assert is_clean("https://example.com/article") is True
    assert is_clean("https://googleadservices.com/track") is False
    assert is_clean("https://example.com/?utm_medium=cpc") is False


def test_extract_domain_strips_www():
    assert extract_domain("https://www.example.com/page") == "example.com"
    assert extract_domain("https://blog.example.com/post") == "blog.example.com"


def test_score_and_rank_filters_ads():
    sources = [
        [{"title": "Ad", "url": "https://doubleclick.net/x", "snippet": "spam", "source": "google"}],
        [{"title": "Real result", "url": "https://example.com", "snippet": "a genuine result", "source": "bing"}],
    ]
    ranked = score_and_rank(sources)
    urls = [r["url"] for r in ranked]
    assert "https://doubleclick.net/x" not in urls
    assert "https://example.com" in urls


def test_score_and_rank_cross_validation_boosts_trust():
    sources = [
        [{"title": "A", "url": "https://example.com", "snippet": "seen on google", "source": "google"}],
        [{"title": "A", "url": "https://example.com", "snippet": "seen on bing too", "source": "bing"}],
    ]
    ranked = score_and_rank(sources)
    assert len(ranked) == 1
    assert ranked[0]["cross_validated"] is True
    assert ranked[0]["trust_score"] == 2


def test_score_and_rank_returns_top_ten_max():
    sources = [[
        {"title": f"Result {i}", "url": f"https://site{i}.com", "snippet": "x" * 10, "source": "google"}
        for i in range(15)
    ]]
    ranked = score_and_rank(sources)
    assert len(ranked) == 10