// Vercel Serverless Function: Liveblocks 룸 관리 API
// Liveblocks REST API를 안전하게 호출하기 위한 프록시

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'node:crypto';

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

const COOKIE_NAME = 'culturemap_admin_session';

function getHeaderValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

function getSigningSecret(): string {
    return process.env.ADMIN_API_TOKEN || process.env.LIVEBLOCKS_SECRET_KEY || '';
}

function sign(value: string, secret: string): string {
    return createHmac('sha256', secret).update(value).digest('base64url');
}

function constantTimeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getCookie(req: VercelRequest, name: string): string | undefined {
    const cookieHeader = getHeaderValue(req.headers.cookie);
    if (!cookieHeader) return undefined;
    const cookies = cookieHeader.split(';').map((part) => part.trim());
    const prefix = `${name}=`;
    return cookies.find((part) => part.startsWith(prefix))?.slice(prefix.length);
}

function hasValidAdminSession(req: VercelRequest): boolean {
    const cookieValue = getCookie(req, COOKIE_NAME);
    const secret = getSigningSecret();
    if (!cookieValue || !secret) return false;

    const [payload, signature] = cookieValue.split('.');
    if (!payload || !signature) return false;
    if (!constantTimeEqual(signature, sign(payload, secret))) return false;

    try {
        const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { expiresAt?: unknown };
        return typeof parsed.expiresAt === 'number' && parsed.expiresAt > Date.now();
    } catch {
        return false;
    }
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

    const assertAdminRequest = () => {
        const allowedOrigin = process.env.APP_ORIGIN;
        const origin = getHeaderValue(req.headers.origin);
        if (allowedOrigin && origin && origin !== allowedOrigin) {
            throw new Error('INVALID_ORIGIN');
        }

        const expectedToken = process.env.ADMIN_API_TOKEN;
        const suppliedToken = getHeaderValue(req.headers['x-admin-token']);
        if (expectedToken && suppliedToken === expectedToken) {
            return;
        }

        if (!hasValidAdminSession(req)) {
            throw new Error('UNAUTHORIZED_ADMIN');
        }
    };

    const assertCultureMapRoomId = (roomId: string) => {
        if (!/^culturemap-v2-[A-Z0-9-]{3,12}$/.test(roomId)) {
            throw new Error('INVALID_ROOM_ID');
        }
    };

    try {
        switch (action) {
            case 'list': {
                assertAdminRequest();
                const rooms: LiveblocksRoom[] = [];
                let nextCursor: string | undefined;

                do {
                    const url = new URL('https://api.liveblocks.io/v2/rooms');
                    url.searchParams.set('limit', '100');
                    if (nextCursor) url.searchParams.set('startingAfter', nextCursor);

                    const response = await fetch(url, {
                        headers: { Authorization: `Bearer ${secretKey}` },
                    });
                    if (!response.ok) {
                        const errorData = await response.text();
                        return res.status(response.status).json({ error: `Failed to list rooms: ${errorData}` });
                    }

                    const data: ListRoomsResponse = await response.json();
                    rooms.push(...(data.data || []));
                    nextCursor = data.nextCursor;
                } while (nextCursor);

                return res.status(200).json({ data: rooms });
            }

            case 'delete': {
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'POST method required for delete' });
                }

                const { roomId } = req.body;
                if (!roomId) {
                    return res.status(400).json({ error: 'roomId is required' });
                }
                assertAdminRequest();
                assertCultureMapRoomId(roomId);

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
                assertAdminRequest();
                roomIds.forEach(assertCultureMapRoomId);

                const results = await Promise.all(
                    roomIds.map(async (roomId: string) => {
                        const response = await fetch(
                            `https://api.liveblocks.io/v2/rooms/${encodeURIComponent(roomId)}`,
                            {
                                method: 'DELETE',
                                headers: { Authorization: `Bearer ${secretKey}` },
                            }
                        );
                        const success = response.status === 204;
                        return {
                            roomId,
                            success,
                            ...(success ? {} : { error: await response.text() }),
                        };
                    })
                );

                return res.status(200).json({ results });
            }

            default:
                return res.status(400).json({ error: 'Invalid action. Use: list, delete, delete-bulk' });
        }
    } catch (error) {
        if ((error as Error).message === 'UNAUTHORIZED_ADMIN') {
            return res.status(401).json({ error: 'Unauthorized admin request' });
        }
        if ((error as Error).message === 'INVALID_ORIGIN') {
            return res.status(403).json({ error: 'Invalid origin' });
        }
        if ((error as Error).message === 'INVALID_ROOM_ID') {
            return res.status(400).json({ error: 'Invalid room id' });
        }
        console.error('Liveblocks Admin API Error:', error);
        return res.status(500).json({ error: `Server error: ${error}` });
    }
}
