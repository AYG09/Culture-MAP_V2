import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'culturemap_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 4;

function getHeaderValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

function getSigningSecret(): string {
    return process.env.ADMIN_API_TOKEN || process.env.LIVEBLOCKS_SECRET_KEY || '';
}

function getExpectedPassword(): string {
    return process.env.GATEWAY_ADMIN_PASSWORD || process.env.VITE_GATEWAY_ADMIN_PASSWORD || 'admin';
}

function sign(value: string, secret: string): string {
    return createHmac('sha256', secret).update(value).digest('base64url');
}

function constantTimeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function createSessionCookie(): string {
    const secret = getSigningSecret();
    if (!secret) throw new Error('ADMIN_SIGNING_SECRET_NOT_CONFIGURED');

    const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
    const payload = Buffer.from(JSON.stringify({ expiresAt, nonce: randomBytes(16).toString('hex') })).toString('base64url');
    const signature = sign(payload, secret);
    return `${payload}.${signature}`;
}

function verifyPassword(input: unknown): boolean {
    if (typeof input !== 'string') return false;
    const expected = getExpectedPassword();
    return constantTimeEqual(input, expected);
}

function assertOrigin(req: VercelRequest): void {
    const allowedOrigin = process.env.APP_ORIGIN;
    const origin = getHeaderValue(req.headers.origin);
    if (allowedOrigin && origin && origin !== allowedOrigin) {
        throw new Error('INVALID_ORIGIN');
    }
}

function getCookieSecurityAttribute(req: VercelRequest): string {
    const forwardedProto = getHeaderValue(req.headers['x-forwarded-proto']);
    const host = getHeaderValue(req.headers.host) || '';
    const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
    return forwardedProto === 'https' || !isLocalhost ? ' Secure;' : '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Cache-Control', 'no-store');

    try {
        assertOrigin(req);

        if (req.method === 'DELETE') {
            res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly;${getCookieSecurityAttribute(req)} SameSite=Lax; Path=/; Max-Age=0`);
            return res.status(200).json({ success: true });
        }

        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'POST method required' });
        }

        if (!verifyPassword(req.body?.password)) {
            return res.status(401).json({ error: 'Invalid admin password' });
        }

        const cookieValue = createSessionCookie();
        res.setHeader('Set-Cookie', `${COOKIE_NAME}=${cookieValue}; HttpOnly;${getCookieSecurityAttribute(req)} SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`);
        return res.status(200).json({ success: true });
    } catch (error) {
        if ((error as Error).message === 'INVALID_ORIGIN') {
            return res.status(403).json({ error: 'Invalid origin' });
        }
        console.error('Admin auth API error:', error);
        return res.status(500).json({ error: 'Admin auth failed' });
    }
}