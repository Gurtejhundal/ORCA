export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  domain: string;
}

/**
 * 100% Free, zero-API-key web search client using DuckDuckGo.
 */
export async function searchDuckDuckGo(
  query: string,
  maxResults = 5,
): Promise<SearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
  const results: SearchResult[] = [];

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`DuckDuckGo search failed with status ${res.status}`);
      return [];
    }

    const html = await res.text();
    const regex =
      /<a class="result__url"[^>]*href="([^"]+)"[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(html)) !== null && results.length < maxResults) {
      const rawUrl = match[1];
      let cleanUrl = rawUrl;
      const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        cleanUrl = decodeURIComponent(uddgMatch[1]);
      }

      const snippet = match[2]
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();

      const domainMatch = cleanUrl.match(/^https?:\/\/([^/]+)/);
      const domain = domainMatch ? domainMatch[1] : 'web';

      if (snippet && cleanUrl.startsWith('http')) {
        results.push({
          title: domain,
          snippet,
          url: cleanUrl,
          domain,
        });
      }
    }
  } catch (error) {
    console.warn('DuckDuckGo search error:', error);
  }

  return results;
}
