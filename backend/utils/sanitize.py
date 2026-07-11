import re

def sanitize_query(query: str, max_length: int = 500) -> str:
    """
    Sanitize user-supplied query to prevent SSRF and header injection.

    Strips:
    - Newlines (\r, \n) that enable HTTP header injection
    - Control characters (\x00-\x1f) that could be exploited
    - Tabs and other whitespace that could confuse parsers

    Args:
        query: User-supplied search query string
        max_length: Maximum query length after sanitization (default 500)

    Returns:
        Sanitized query safe to use in HTTP requests
    """
    if not query:
        return ""

    sanitized = re.sub(r'[\r\n\x00-\x1f\t]', '', query)
    return sanitized[:max_length].strip()
