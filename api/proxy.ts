
import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Expecting { url: string } in body
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Missing URL' });
    }

    try {
        console.log(`[Proxy] Fetching: ${url}`);

        // Server-side fetch (bypasses CORS)
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Upstream error: ${response.statusText}`);
        }

        const csvText = await response.text();

        // Return CSV text directly
        res.setHeader('Content-Type', 'text/csv');
        return res.status(200).send(csvText);

    } catch (error: any) {
        console.error('Proxy Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
