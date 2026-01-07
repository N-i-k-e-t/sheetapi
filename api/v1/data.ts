
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Initialize Supabase Client
// Note: In Vercel environment, ensure these ENV variables are set.
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: 'Server configuration error: Missing DB credentials.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Extract API Key (Bearer or Query)
    let apiKey = req.query.apiKey as string;
    if (!apiKey && req.headers.authorization) {
        const parts = req.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
            apiKey = parts[1];
        }
    }

    if (!apiKey) {
        return res.status(401).json({ error: 'Unauthorized: Missing API Key' });
    }

    // 2. Validate API Key
    const { data: keyData, error: keyError } = await supabase
        .from('api_keys')
        .select('id, owner_name')
        .eq('key_value', apiKey)
        .eq('is_active', true)
        .single();

    if (keyError || !keyData) {
        return res.status(403).json({ error: 'Forbidden: Invalid or inactive API Key' });
    }

    // 3. Log the Request (Async - fire and forget)
    supabase.from('audit_logs').insert({
        action: 'API_PULL',
        status: 'SUCCESS',
        details: `Remote pull by ${keyData.owner_name} (IP: ${req.headers['x-forwarded-for'] || 'unknown'})`
    }).then(() => { });

    // 4a. Time Restriction (9 AM - 11 AM IST)
    // IST = UTC + 5:30
    const now = new Date();
    // Calculate IST time
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    const istHours = istTime.getUTCHours(); // getUTCHours on adjusted time gives "local" hour if interpreted right, but safer to use total minutes

    // Better: Get UTC hours and convert manual
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const totalMinutesUTC = utcHours * 60 + utcMinutes;

    // 9:00 AM IST = 03:30 UTC = 210 mins
    // 11:00 AM IST = 05:30 UTC = 330 mins
    const startMins = 3 * 60 + 30;
    const endMins = 5 * 60 + 30;

    // Uncomment to ENFORCE:
    // if (totalMinutesUTC < startMins || totalMinutesUTC > endMins) {
    //    return res.status(403).json({ error: "Access Denied: API available 09:00 - 11:00 AM IST only." });
    // }

    // 4b. Fetch Records
    // Optional: Filter by date ?date=2026-01-07
    const dateFilter = req.query.date as string;

    let query = supabase
        .from('records')
        .select('id, date, raw_data, created_at')
        .order('created_at', { ascending: false });

    if (dateFilter) {
        query = query.eq('date', dateFilter);
    }

    const { data, error } = await query;

    if (error) {
        return res.status(500).json({ error: 'Database error fetching records' });
    }

    // 5. Return Clean JSON
    return res.status(200).json({
        status: 'success',
        requester: keyData.owner_name,
        count: data?.length || 0,
        data: data?.map(r => ({
            id: r.id,
            date: r.date,
            ...r.raw_data // Flatten the JSON
        }))
    });
}
