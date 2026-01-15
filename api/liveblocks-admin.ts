// Vercel Serverless Function: Liveblocks 룸 관리 API
// Liveblocks REST API를 안전하게 호출하기 위한 프록시

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface LiveblocksRoom {
    id: string;
    type: string;
    lastConnectionAt: string;
    createdAt: string;
    defaultAccesses: string[];
    metadata?: Record<string, string>;
}

interface ListRoomsResponse {
    data: LiveblocksRoom[];
    nextCursor?: string;
}

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    const secretKey = process.env.LIVEBLOCKS_SECRET_KEY;

    if (!secretKey) {
        return res.status(500).json({ error: 'LIVEBLOCKS_SECRET_KEY not configured' });
    }

    const action = req.query.action as string;

    try {
        switch (action) {
            case 'list': {
                const response = await fetch('https://api.liveblocks.io/v2/rooms?limit=100', {
                    headers: { Authorization: `Bearer ${secretKey}` },
                });
                const data: ListRoomsResponse = await response.json();
                return res.status(200).json(data);
            }

            case 'delete': {
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'POST method required for delete' });
                }

                const { roomId } = req.body;
                if (!roomId) {
                    return res.status(400).json({ error: 'roomId is required' });
                }

                const response = await fetch(
                    `https://api.liveblocks.io/v2/rooms/${encodeURIComponent(roomId)}`,
                    {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${secretKey}` },
                    }
                );

                if (response.status === 204) {
                    return res.status(200).json({ success: true, message: `Room ${roomId} deleted` });
                } else {
                    const errorData = await response.text();
                    return res.status(response.status).json({ error: `Failed to delete room: ${errorData}` });
                }
            }

            case 'delete-bulk': {
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'POST method required for bulk delete' });
                }

                const { roomIds } = req.body;
                if (!roomIds || !Array.isArray(roomIds)) {
                    return res.status(400).json({ error: 'roomIds array is required' });
                }

                const results = await Promise.all(
                    roomIds.map(async (roomId: string) => {
                        const response = await fetch(
                            `https://api.liveblocks.io/v2/rooms/${encodeURIComponent(roomId)}`,
                            {
                                method: 'DELETE',
                                headers: { Authorization: `Bearer ${secretKey}` },
                            }
                        );
                        return { roomId, success: response.status === 204 };
                    })
                );

                return res.status(200).json({ results });
            }

            default:
                return res.status(400).json({ error: 'Invalid action. Use: list, delete, delete-bulk' });
        }
    } catch (error) {
        console.error('Liveblocks Admin API Error:', error);
        return res.status(500).json({ error: `Server error: ${error}` });
    }
}
