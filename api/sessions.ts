import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Liveblocks } from '@liveblocks/node';

type SessionType = 'workshop' | 'consulting';

type SessionRecord = {
    code: string;
    name: string;
    type: SessionType;
    createdAt: number;
    organization?: string;
    alias?: string;
};

const ROOM_PREFIX = 'culturemap-v2-';
const CODE_PATTERN = /^[A-Z0-9-]{3,12}$/;
const createAttempts = new Map<string, number[]>();

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

function getClientKey(req: VercelRequest): string {
    return getHeaderValue(req.headers['x-forwarded-for'])?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

function assertRateLimit(key: string): void {
    const now = Date.now();
    const windowMs = 10 * 60 * 1000;
    const maxAttempts = 5;
    const attempts = (createAttempts.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
    if (attempts.length >= maxAttempts) {
        throw new Error('RATE_LIMITED');
    }
    attempts.push(now);
    createAttempts.set(key, attempts);
}

function normalizeCode(code: unknown): string | null {
    if (typeof code !== 'string') return null;
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    return CODE_PATTERN.test(normalized) ? normalized : null;
}

function generateSessionCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let index = 0; index < 6; index += 1) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
}

function toStringMetadata(metadata: Record<string, unknown>): Record<string, string> {
    return Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, String(value)]));
}

function roomToSession(room: { id: string; metadata?: Record<string, unknown>; createdAt?: string }): SessionRecord | null {
    if (!room.id.startsWith(ROOM_PREFIX)) return null;

    const metadata = room.metadata || {};
    if (metadata.deleted === 'true') return null;

    const code = room.id.slice(ROOM_PREFIX.length);
    const type = metadata.type === 'consulting' ? 'consulting' : 'workshop';
    const createdAtRaw = metadata.createdAt;
    const createdAt = typeof createdAtRaw === 'number'
        ? createdAtRaw
        : typeof createdAtRaw === 'string'
            ? Number(createdAtRaw)
            : room.createdAt
                ? new Date(room.createdAt).getTime()
                : Date.now();

    return {
        code,
        name: typeof metadata.name === 'string' && metadata.name ? metadata.name : `세션 ${code}`,
        type,
        createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
        organization: typeof metadata.organization === 'string' ? metadata.organization : undefined,
        alias: typeof metadata.alias === 'string' ? metadata.alias : undefined,
    };
}

async function listSessions(liveblocks: Liveblocks): Promise<SessionRecord[]> {
    const sessions: SessionRecord[] = [];
    for await (const room of liveblocks.iterRooms({ query: { roomId: { startsWith: ROOM_PREFIX } } })) {
        const session = roomToSession(room as { id: string; metadata?: Record<string, unknown>; createdAt?: string });
        if (session) sessions.push(session);
    }
    return sessions.sort((left, right) => right.createdAt - left.createdAt);
}

async function createSession(req: VercelRequest, res: VercelResponse, liveblocks: Liveblocks) {
    assertRateLimit(getClientKey(req));

    const requestedCode = normalizeCode(req.body?.code);
    const code = requestedCode || generateSessionCode();
    const roomId = `${ROOM_PREFIX}${code}`;
    const sessionType: SessionType = req.body?.type === 'consulting' ? 'consulting' : 'workshop';
    const name = typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim().slice(0, 120) : `세션 ${code}`;
    const organization = typeof req.body?.organization === 'string' ? req.body.organization.trim().slice(0, 120) : '';
    const createdAt = Date.now();

    await liveblocks.getOrCreateRoom(roomId, {
        defaultAccesses: [],
        metadata: {
            code,
            name,
            type: sessionType,
            createdAt: String(createdAt),
            ...(organization && { organization }),
        },
    });

    return res.status(201).json({ code, name, type: sessionType, createdAt, organization: organization || undefined });
}

async function updateSession(req: VercelRequest, res: VercelResponse, liveblocks: Liveblocks) {
    const code = normalizeCode(req.body?.code);
    if (!code) return res.status(400).json({ error: 'Valid code is required' });

    const roomId = `${ROOM_PREFIX}${code}`;
    const existing = await liveblocks.getRoom(roomId);
    const currentMetadata = toStringMetadata((existing.metadata || {}) as Record<string, unknown>);
    const nextMetadata: Record<string, string> = {};

    if (typeof req.body?.name === 'string') nextMetadata.name = req.body.name.trim().slice(0, 120);
    if (req.body?.type === 'workshop' || req.body?.type === 'consulting') nextMetadata.type = req.body.type;
    if (typeof req.body?.organization === 'string') nextMetadata.organization = req.body.organization.trim().slice(0, 120);
    if (typeof req.body?.alias === 'string') nextMetadata.alias = req.body.alias.trim().toUpperCase().slice(0, 40);

    await liveblocks.updateRoom(roomId, { metadata: { ...currentMetadata, ...nextMetadata } });
    return res.status(200).json({ success: true });
}

async function deleteSession(req: VercelRequest, res: VercelResponse, liveblocks: Liveblocks) {
    const code = normalizeCode(req.body?.code);
    if (!code) return res.status(400).json({ error: 'Valid code is required' });

    const roomId = `${ROOM_PREFIX}${code}`;
    const existing = await liveblocks.getRoom(roomId);
    await liveblocks.updateRoom(roomId, {
        metadata: {
            ...toStringMetadata((existing.metadata || {}) as Record<string, unknown>),
            deleted: 'true',
        },
    });
    return res.status(200).json({ success: true });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Cache-Control', 'no-store');

    try {
        const liveblocks = getLiveblocksClient();
        const action = String(req.query.action || req.body?.action || 'list');

        if (req.method === 'GET' && action === 'list') {
            return res.status(200).json({ sessions: await listSessions(liveblocks) });
        }

        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'POST method required' });
        }

        if (action === 'create') return await createSession(req, res, liveblocks);
        if (action === 'update') return await updateSession(req, res, liveblocks);
        if (action === 'delete') return await deleteSession(req, res, liveblocks);

        return res.status(400).json({ error: 'Invalid action' });
    } catch (error) {
        if ((error as Error).message === 'RATE_LIMITED') {
            return res.status(429).json({ error: 'Too many session creation attempts' });
        }
        console.error('Sessions API error:', error);
        return res.status(500).json({ error: 'Sessions API failed' });
    }
}