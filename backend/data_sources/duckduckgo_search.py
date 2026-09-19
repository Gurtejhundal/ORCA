import logging
import re
import urllib.parse
from typing import Any
import httpx

logger = logging.getLogger(__name__)


class DuckDuckGoSearch:
    """Zero-configuration, 100% free web search client powered by DuckDuckGo."""

    def __init__(self, timeout: float = 12.0):
        self.timeout = timeout
        self.headers = {
            'User-Agent': (
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/124.0.0.0 Safari/537.36'
            ),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        }

    async def search(self, query: str, max_results: int = 5) -> list[dict[str, Any]]:
        clean_query = query.strip()
        if not clean_query:
            return []

        url = f'https://html.duckduckgo.com/html/?q={urllib.parse.quote(clean_query)}'
        results = []

        try:
            async with httpx.AsyncClient(headers=self.headers, timeout=self.timeout, follow_redirects=True) as client:
                resp = await client.get(url)
                if resp.status_code != 200:
                    logger.warning("duckduckgo_search_failed status=%d", resp.status_code)
                    return []

                html = resp.text
                pattern = re.compile(
                    r'<a class="result__url"[^>]*href="([^"]+)"[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)</a>'
                )

                for match in pattern.finditer(html):
                    raw_url, raw_snip = match.group(1), match.group(2)
                    uddg = re.search(r'uddg=([^&]+)', raw_url)
                    dest_url = urllib.parse.unquote(uddg.group(1)) if uddg else raw_url

                    # Clean html tags & entities from snippet
                    clean_snip = (
                        re.sub(r'<[^>]+>', '', raw_snip)
                        .replace('&quot;', '"')
                        .replace('&#x27;', "'")
                        .replace('&amp;', '&')
                        .replace('&lt;', '<')
                        .replace('&gt;', '>')
                        .strip()
                    )

                    # Extract domain
                    domain_match = re.search(r'https?://([^/]+)', dest_url)
                    domain = domain_match.group(1) if domain_match else 'web'

                    if clean_snip and dest_url.startswith('http'):
                        results.append({
                            'url': dest_url,
                            'snippet': clean_snip,
                            'domain': domain,
                        })

                    if len(results) >= max_results:
                        break

        except Exception as e:
            logger.warning("duckduckgo_search_exception query=%s error=%s", clean_query, str(e))

        return results
