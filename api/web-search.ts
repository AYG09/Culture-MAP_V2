import type { VercelRequest, VercelResponse } from '@vercel/node';
import { normalizeSearchInput, performWebSearch } from './web-search-shared';

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'POST method required' });
    }

    const headerValue = req.headers['x-tavily-api-key'];
    const userApiKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const apiKey = (typeof userApiKey === 'string' && userApiKey.trim()) || process.env.TAVILY_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'TAVILY_API_KEY not configured' });
    }

    const { query, maxResults } = normalizeSearchInput(req.body?.query, req.body?.maxResults);

    if (!query) {
        return res.status(400).json({ error: 'query is required' });
    }

    try {
        const result = await performWebSearch(query, maxResults, apiKey);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Web search API error:', error);
        const message = error instanceof Error ? error.message : 'Web search server error';
        return res.status(500).json({ error: message });
    }
}
