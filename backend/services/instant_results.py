import re

import httpx


MAX_INSTANT_RESULTS = 12


def _clean_query(query: str) -> str:
    return " ".join((query or "search").split()) or "search"


def _site_search_url(base_url: str, param: str, query: str) -> str:
    return f"{base_url}?{httpx.QueryParams({param: query})}"


def _result(title: str, url: str, snippet: str, source: str = "instant") -> dict:
    return {
        "title": title,
        "url": url,
        "snippet": snippet,
        "source": source,
        "trust_score": 1,
        "cross_validated": False,
    }


KNOWN_TOPIC_RESULTS = {
    "artificial": [
        ("Artificial intelligence - Wikipedia", "https://en.wikipedia.org/wiki/Artificial_intelligence", "Overview of artificial intelligence, its history, techniques, and applications."),
        ("Artificial intelligence - Britannica", "https://www.britannica.com/technology/artificial-intelligence", "Encyclopedia overview of AI concepts and development."),
        ("What is artificial intelligence? - IBM", "https://www.ibm.com/think/topics/artificial-intelligence", "Plain-language explanation of AI, machine learning, and enterprise uses."),
        ("What is AI? - Google Cloud", "https://cloud.google.com/learn/what-is-artificial-intelligence", "Google Cloud guide to AI concepts, models, and business use cases."),
        ("What is Artificial Intelligence? - AWS", "https://aws.amazon.com/what-is/artificial-intelligence/", "AWS overview of AI technologies and common implementation patterns."),
        ("AI Index Report - Stanford HAI", "https://aiindex.stanford.edu/report/", "Research-backed annual reports tracking AI trends, industry, and policy."),
        ("Machine learning - Wikipedia", "https://en.wikipedia.org/wiki/Machine_learning", "Related field covering algorithms that learn patterns from data."),
        ("Deep learning - Wikipedia", "https://en.wikipedia.org/wiki/Deep_learning", "Neural-network based methods used in modern AI systems."),
        ("Artificial Intelligence courses - Coursera", "https://www.coursera.org/search?query=artificial%20intelligence", "Courses and learning paths for AI foundations and applications."),
        ("Artificial Intelligence - Microsoft Azure", "https://azure.microsoft.com/en-us/resources/cloud-computing-dictionary/artificial-intelligence", "Microsoft explanation of AI in cloud and application development."),
        ("Artificial intelligence - NVIDIA", "https://www.nvidia.com/en-us/glossary/artificial-intelligence/", "Hardware and accelerated-computing view of AI workloads."),
        ("AI articles - MIT News", "https://news.mit.edu/topic/artificial-intelligence2", "Research news and explainers about artificial intelligence."),
    ],
    "ai": [],
    "artificial intelligence": [],
    "machine learning": [
        ("Machine learning - Wikipedia", "https://en.wikipedia.org/wiki/Machine_learning", "Overview of machine learning algorithms, history, and applications."),
        ("What is machine learning? - IBM", "https://www.ibm.com/think/topics/machine-learning", "Explanation of supervised, unsupervised, and reinforcement learning."),
        ("Machine Learning Crash Course - Google", "https://developers.google.com/machine-learning/crash-course", "Hands-on Google course for machine learning basics."),
        ("Machine learning - AWS", "https://aws.amazon.com/what-is/machine-learning/", "Cloud-focused overview of machine learning systems."),
        ("Machine learning - Stanford Online", "https://online.stanford.edu/courses/sohs-ystatslearning-statistical-learning", "Learning resource connected to statistical learning concepts."),
    ],
    "python": [
        ("Python programming language - Official site", "https://www.python.org/", "Official Python website with downloads, docs, and news."),
        ("Python documentation", "https://docs.python.org/3/", "Official Python 3 documentation and library reference."),
        ("Python tutorial", "https://docs.python.org/3/tutorial/", "Official beginner-friendly Python tutorial."),
        ("Python - Wikipedia", "https://en.wikipedia.org/wiki/Python_(programming_language)", "Overview of Python history, design, and ecosystem."),
        ("Real Python", "https://realpython.com/", "Python tutorials, examples, and practical guides."),
    ],
    "react": [
        ("React official docs", "https://react.dev/", "Official React documentation, tutorials, and API references."),
        ("React Learn", "https://react.dev/learn", "Official learning path for components, state, and hooks."),
        ("React - Wikipedia", "https://en.wikipedia.org/wiki/React_(software)", "Overview of the React JavaScript library."),
        ("React GitHub repository", "https://github.com/facebook/react", "Source code and issues for React."),
        ("React package - npm", "https://www.npmjs.com/package/react", "React package metadata and versions on npm."),
    ],
    "electron": [
        ("Electron official site", "https://www.electronjs.org/", "Official Electron framework site."),
        ("Electron documentation", "https://www.electronjs.org/docs/latest/", "Official Electron API and guide documentation."),
        ("Electron - GitHub", "https://github.com/electron/electron", "Electron source code, releases, and issues."),
        ("Electron - Wikipedia", "https://en.wikipedia.org/wiki/Electron_(software_framework)", "Overview of the Electron desktop application framework."),
        ("Electron Forge", "https://www.electronforge.io/", "Tooling for packaging and publishing Electron apps."),
    ],
}

KNOWN_TOPIC_RESULTS["ai"] = KNOWN_TOPIC_RESULTS["artificial"]
KNOWN_TOPIC_RESULTS["artificial intelligence"] = KNOWN_TOPIC_RESULTS["artificial"]


def create_instant_results(query: str, limit: int = MAX_INSTANT_RESULTS) -> list[dict]:
    clean_query = _clean_query(query)
    normalized = clean_query.lower()
    slug = re.sub(r"\s+", "_", clean_query)

    topic_results = [
        _result(title, url, snippet)
        for title, url, snippet in KNOWN_TOPIC_RESULTS.get(normalized, [])
    ]

    generic_results = [
        _result(f"{clean_query.title()} - Wikipedia", f"https://en.wikipedia.org/wiki/{slug}", f"Open the main Wikipedia page for {clean_query}."),
        _result(f"Wikipedia search for {clean_query}", _site_search_url("https://en.wikipedia.org/w/index.php", "search", clean_query), f"Browse matching Wikipedia pages for {clean_query}."),
        _result(f"Britannica search for {clean_query}", _site_search_url("https://www.britannica.com/search", "query", clean_query), f"Browse encyclopedia results for {clean_query}."),
        _result(f"Internet Archive search for {clean_query}", _site_search_url("https://archive.org/search", "query", clean_query), f"Find archived pages, books, and media for {clean_query}."),
        _result(f"GitHub search for {clean_query}", _site_search_url("https://github.com/search", "q", clean_query), f"Find repositories and code related to {clean_query}."),
        _result(f"Stack Overflow search for {clean_query}", _site_search_url("https://stackoverflow.com/search", "q", clean_query), f"Find developer questions and answers for {clean_query}."),
        _result(f"MDN search for {clean_query}", _site_search_url("https://developer.mozilla.org/en-US/search", "q", clean_query), f"Search MDN documentation for {clean_query}."),
        _result(f"Coursera search for {clean_query}", _site_search_url("https://www.coursera.org/search", "query", clean_query), f"Find courses and learning paths for {clean_query}."),
        _result(f"MIT News search for {clean_query}", _site_search_url("https://news.mit.edu/search", "keyword", clean_query), f"Find research news related to {clean_query}."),
        _result(f"YouTube search for {clean_query}", _site_search_url("https://www.youtube.com/results", "search_query", clean_query), f"Find videos about {clean_query}."),
        _result(f"Reddit search for {clean_query}", _site_search_url("https://www.reddit.com/search/", "q", clean_query), f"Find community discussions about {clean_query}."),
        _result(f"Google Scholar search for {clean_query}", _site_search_url("https://scholar.google.com/scholar", "q", clean_query), f"Find scholarly results for {clean_query}."),
    ]

    seen_urls: set[str] = set()
    combined: list[dict] = []
    for item in [*topic_results, *generic_results]:
        url = item.get("url", "")
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        combined.append(item)
        if len(combined) >= limit:
            break

    return combined


def create_instant_ai_response(query: str, persona: str = "default", gl: str = "us") -> dict:
    clean_query = _clean_query(query)
    sources = create_instant_results(clean_query, limit=8)
    source_lines = "\n".join(
        f"- {item['title']}: {item['url']}"
        for item in sources[:5]
    )
    answer = (
        f"Here are fast SuperBrowser results for \"{clean_query}\". "
        "Live AI synthesis is unavailable or still warming up, so this answer is grounded in the sources below.\n\n"
        "Top places to start:\n"
        f"{source_lines}\n\n"
        "Open any result to continue browsing inside SuperBrowser."
    )
    return {
        "query": clean_query,
        "answer": answer,
        "sources": sources,
        "persona": persona,
        "persona_used": "SuperBrowser Fast AI",
        "model_used": "instant-fallback",
        "context_used": False,
        "live_data": False,
        "sources_scraped": len(sources),
        "region": gl,
        "status": "fallback",
    }
