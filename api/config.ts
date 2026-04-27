import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Liveblocks } from '@liveblocks/node';
import { createHmac, timingSafeEqual } from 'node:crypto';

const CONFIG_ROOM_ID = 'culturemap-admin-config';
const DEFAULT_MASTER_KEY = 'welcome09@!';
const ADMIN_COOKIE_NAME = 'culturemap_admin_session';
const ADMIN_ACTIONS = new Set([
    'getHostPassword',
    'setHostPassword',
    'getMasterKey',
    'setMasterKey',
    'getAllOrganizationPasswords',
    'setOrganizationPassword',
    'getOrganizationPassword',
    'deleteOrganizationPassword',
    'getAllSessionPasswords',
    'setSessionPassword',
    'getSessionPassword',
    'deleteSessionPassword',
]);

function getLiveblocksClient(): Liveblocks {
    const secret = process.env.LIVEBLOCKS_SECRET_KEY;
    if (!secret) {
        throw new Error('LIVEBLOCKS_SECRET_KEY not configured');
    }
    return new Liveblocks({ secret });
}

function parseJsonRecord(value: unknown): Record<string, string> {
    if (typeof value !== 'string' || !value) return {};
    try {
        const parsed = JSON.parse(value) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>).map(([key, item]) => [key, String(item)])
        );
    } catch {
        return {};
    }
}

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
    const cookieValue = getCookie(req, ADMIN_COOKIE_NAME);
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

function assertAdminRequest(req: VercelRequest): void {
    const allowedOrigin = process.env.APP_ORIGIN;
    const origin = getHeaderValue(req.headers.origin);
    if (allowedOrigin && origin && origin !== allowedOrigin) {
        throw new Error('INVALID_ORIGIN');
    }

    const expectedToken = process.env.ADMIN_API_TOKEN;
    const suppliedToken = getHeaderValue(req.headers['x-admin-token']);
    if (expectedToken && suppliedToken === expectedToken) return;
    if (!hasValidAdminSession(req)) throw new Error('UNAUTHORIZED_ADMIN');
}

async function getConfigMetadata(liveblocks: Liveblocks): Promise<Record<string, string>> {
    const room = await liveblocks.getOrCreateRoom(CONFIG_ROOM_ID, {
        defaultAccesses: [],
        metadata: {
            masterKey: DEFAULT_MASTER_KEY,
            organizationPasswords: '{}',
            sessionPasswords: '{}',
        },
    });
    return Object.fromEntries(Object.entries((room.metadata || {}) as Record<string, unknown>).map(([key, value]) => [key, String(value)]));
}

async function updateConfigMetadata(liveblocks: Liveblocks, patch: Record<string, string>): Promise<void> {
    const current = await getConfigMetadata(liveblocks);
    await liveblocks.updateRoom(CONFIG_ROOM_ID, {
        metadata: {
            ...current,
            ...patch,
            updatedAt: String(Date.now()),
        },
    });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Cache-Control', 'no-store');

    try {
        const liveblocks = getLiveblocksClient();
        const action = String(req.query.action || req.body?.action || '');
        if (ADMIN_ACTIONS.has(action)) assertAdminRequest(req);
        const metadata = await getConfigMetadata(liveblocks);

        if (action === 'getHostPassword') return res.status(200).json({ value: metadata.hostPassword || null });
        if (action === 'setHostPassword') {
            await updateConfigMetadata(liveblocks, { hostPassword: String(req.body?.password || '') });
            return res.status(200).json({ success: true });
        }
        if (action === 'validateHostPassword') {
            return res.status(200).json({ valid: Boolean(metadata.hostPassword) && String(req.body?.password || '') === metadata.hostPassword });
        }

        if (action === 'getMasterKey') return res.status(200).json({ value: metadata.masterKey || DEFAULT_MASTER_KEY });
        if (action === 'setMasterKey') {
            await updateConfigMetadata(liveblocks, { masterKey: String(req.body?.key || '') });
            return res.status(200).json({ success: true });
        }
        if (action === 'validateMasterKey') {
            return res.status(200).json({ valid: String(req.body?.key || '') === (metadata.masterKey || DEFAULT_MASTER_KEY) });
        }

        const organizationPasswords = parseJsonRecord(metadata.organizationPasswords);
        if (action === 'getAllOrganizationPasswords') return res.status(200).json({ value: organizationPasswords });
        if (action === 'setOrganizationPassword') {
            const org = String(req.body?.organization || '');
            organizationPasswords[org] = String(req.body?.password || '');
            await updateConfigMetadata(liveblocks, { organizationPasswords: JSON.stringify(organizationPasswords) });
            return res.status(200).json({ success: true });
        }
        if (action === 'getOrganizationPassword') return res.status(200).json({ value: organizationPasswords[String(req.body?.organization || '')] || null });
        if (action === 'hasOrganizationPassword') return res.status(200).json({ exists: Boolean(organizationPasswords[String(req.body?.organization || '')]) });
        if (action === 'validateOrganizationPassword') {
            const saved = organizationPasswords[String(req.body?.organization || '')];
            return res.status(200).json({ valid: !saved || saved.toLowerCase() === String(req.body?.password || '').toLowerCase() });
        }
        if (action === 'deleteOrganizationPassword') {
            delete organizationPasswords[String(req.body?.organization || '')];
            await updateConfigMetadata(liveblocks, { organizationPasswords: JSON.stringify(organizationPasswords) });
            return res.status(200).json({ success: true });
        }

        const sessionPasswords = parseJsonRecord(metadata.sessionPasswords);
        if (action === 'getAllSessionPasswords') return res.status(200).json({ value: sessionPasswords });
        if (action === 'setSessionPassword') {
            sessionPasswords[String(req.body?.sessionCode || '')] = String(req.body?.password || '');
            await updateConfigMetadata(liveblocks, { sessionPasswords: JSON.stringify(sessionPasswords) });
            return res.status(200).json({ success: true });
        }
        if (action === 'getSessionPassword') return res.status(200).json({ value: sessionPasswords[String(req.body?.sessionCode || '')] || null });
        if (action === 'hasSessionPassword') return res.status(200).json({ exists: Boolean(sessionPasswords[String(req.body?.sessionCode || '')]) });
        if (action === 'validateSessionPassword') {
            const saved = sessionPasswords[String(req.body?.sessionCode || '')];
            return res.status(200).json({ valid: !saved || saved.toLowerCase() === String(req.body?.password || '').toLowerCase() });
        }
        if (action === 'deleteSessionPassword') {
            delete sessionPasswords[String(req.body?.sessionCode || '')];
            await updateConfigMetadata(liveblocks, { sessionPasswords: JSON.stringify(sessionPasswords) });
            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Invalid action' });
    } catch (error) {
        if ((error as Error).message === 'UNAUTHORIZED_ADMIN') {
            return res.status(401).json({ error: 'Unauthorized admin request' });
        }
        if ((error as Error).message === 'INVALID_ORIGIN') {
            return res.status(403).json({ error: 'Invalid origin' });
        }
        console.error('Config API error:', error);
        return res.status(500).json({ error: 'Config API failed' });
    }
}