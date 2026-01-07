
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Native fetch (Node 18+)
export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { url } = req.body || {};
        if (!url) throw new Error('Missing URL');

        console.log(`[Proxy] Requesting: ${url}`);

        const upstream = await fetch(url);
        if (!upstream.ok) throw new Error(`Google returned ${upstream.status}`);

        const text = await upstream.text();

        // Safety Check: Google Error Pages are usually HTML
        if (text.includes('<!DOCTYPE html') || text.includes('<html')) {
            throw new Error('Invalid Sheet Link (HTML returned). Make sure it is "Published to Web".');
        }

        res.setHeader('Content-Type', 'text/csv');
        res.status(200).send(text);

    } catch (error: any) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: error.message });
    }
}
