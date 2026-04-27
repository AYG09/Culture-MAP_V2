import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Liveblocks } from '@liveblocks/node';

const ROOM_ID_PATTERN = /^culturemap-v2-[A-Z0-9-]{3,12}$/;

function getLiveblocksClient(): Liveblocks {
    const secret = process.env.LIVEBLOCKS_SECRET_KEY;
    if (!secret) {
        throw new Error('LIVEBLOCKS_SECRET_KEY not configured');
    }
    return new Liveblocks({ secret });
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

function getUser(req: VercelRequest): { id: string; name: string; color: string } {
    const requestedUserId = getHeaderValue(req.headers['x-culturemap-user-id']);
    const requestedName = getHeaderValue(req.headers['x-culturemap-user-name']);
    const requestedColor = getHeaderValue(req.headers['x-culturemap-user-color']);
    const ip = getHeaderValue(req.headers['x-forwarded-for'])?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const fallbackId = `guest-${Buffer.from(ip).toString('base64url').slice(0, 16)}`;

    return {
        id: requestedUserId && /^[A-Za-z0-9_-]{3,80}$/.test(requestedUserId) ? requestedUserId : fallbackId,
        name: requestedName?.slice(0, 80) || '익명',
        color: /^#[0-9a-fA-F]{6}$/.test(requestedColor || '') ? requestedColor! : '#888888',
    };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'POST method required' });
    }

    const room = typeof req.body?.room === 'string' ? req.body.room : '';
    if (!ROOM_ID_PATTERN.test(room)) {
        return res.status(403).json({ error: 'Room is not allowed' });
    }

    try {
        const liveblocks = getLiveblocksClient();
        await liveblocks.getRoom(room);

        const user = getUser(req);
        const session = liveblocks.prepareSession(user.id, {
            userInfo: {
                name: user.name,
                color: user.color,
            },
        });

        session.allow(room, session.FULL_ACCESS);
        const { status, body } = await session.authorize();

        res.setHeader('Cache-Control', 'no-store');
        return res.status(status).send(body);
    } catch (error) {
        const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status: unknown }).status) : 500;
        if (status === 404) {
            return res.status(403).json({ error: 'Room is not registered' });
        }
        console.error('Liveblocks auth error:', error);
        return res.status(500).json({ error: 'Liveblocks authorization failed' });
    }
}