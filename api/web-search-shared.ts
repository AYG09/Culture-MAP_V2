export type WebSearchResult = {
    title: string;
    url: string;
    content: string;
    publishedDate?: string;
    source?: string;
};

type TavilyResult = {
    title?: string;
    url?: string;
    content?: string;
    published_date?: string;
};

type TavilyResponse = {
    results?: TavilyResult[];
};

export async function performWebSearch(query: string, maxResults: number, apiKey: string) {
    const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            api_key: apiKey,
            query,
            search_depth: 'advanced',
            topic: 'general',
            max_results: maxResults,
            include_raw_content: false,
            include_images: false
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tavily search failed: ${errorText}`);
    }

    const data = await response.json() as TavilyResponse;
    const results: WebSearchResult[] = Array.isArray(data.results)
        ? data.results
            .filter((item) => item.title && item.url && item.content)
            .map((item) => ({
                title: item.title!,
                url: item.url!,
                content: item.content!,
                publishedDate: item.published_date,
                source: safeHostname(item.url)
            }))
        : [];

    return {
        query,
        provider: 'tavily' as const,
        results
    };
}

export function normalizeSearchInput(rawQuery: unknown, rawMaxResults: unknown) {
    const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';
    const maxResultsValue = Number(rawMaxResults);
    const maxResults = Number.isFinite(maxResultsValue)
        ? Math.max(1, Math.min(8, Math.floor(maxResultsValue)))
        : 5;

    return {
        query,
        maxResults
    };
}

function safeHostname(url?: string): string | undefined {
    if (!url) return undefined;
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return undefined;
    }
}