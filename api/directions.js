/**
 * Vercel Serverless Function: Directions API Proxy
 * Securely calls Google Directions API without exposing API key to clients
 * Includes rate limiting to prevent abuse
 */

// Simple in-memory rate limiter
// Note: In serverless, this resets on cold starts. For production-scale apps,
// consider using Vercel KV or Upstash Redis for persistent rate limiting.
const rateLimitMap = new Map();
const RATE_LIMIT = {
    windowMs: 60 * 1000,      // 1 minute window
    maxRequests: 60,          // Max 60 requests per minute per IP (enough for 1 stacked analysis)
    dailyLimit: 1000          // Max 1000 requests per day per IP (~20 stacked analyses)
};

function getRateLimitKey(ip) {
    return `${ip}_${new Date().toISOString().split('T')[0]}`; // IP + date
}

function checkRateLimit(ip) {
    const now = Date.now();
    const dailyKey = getRateLimitKey(ip);

    // Get or create rate limit entry
    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, { count: 0, windowStart: now, dailyKey, dailyCount: 0 });
    }

    const entry = rateLimitMap.get(ip);

    // Reset daily count if it's a new day
    if (entry.dailyKey !== dailyKey) {
        entry.dailyKey = dailyKey;
        entry.dailyCount = 0;
    }

    // Reset window if expired
    if (now - entry.windowStart > RATE_LIMIT.windowMs) {
        entry.count = 0;
        entry.windowStart = now;
    }

    // Check limits
    if (entry.dailyCount >= RATE_LIMIT.dailyLimit) {
        return { allowed: false, reason: 'Daily limit exceeded. Try again tomorrow.' };
    }

    if (entry.count >= RATE_LIMIT.maxRequests) {
        const retryAfter = Math.ceil((entry.windowStart + RATE_LIMIT.windowMs - now) / 1000);
        return { allowed: false, reason: `Too many requests. Try again in ${retryAfter} seconds.` };
    }

    // Increment counters
    entry.count++;
    entry.dailyCount++;

    return { allowed: true };
}

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get client IP
    const ip = req.headers['x-forwarded-for']?.split(',')[0] ||
        req.headers['x-real-ip'] ||
        req.socket?.remoteAddress ||
        'unknown';

    // Check rate limit
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
        return res.status(429).json({ error: rateCheck.reason });
    }

    const { origin, destination, departureTime, trafficModel } = req.body;

    // Validate required fields
    if (!origin || !destination || !departureTime) {
        return res.status(400).json({
            error: 'Missing required fields: origin, destination, departureTime'
        });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.error('GOOGLE_API_KEY environment variable not set');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    // Convert departureTime to Unix timestamp if it's an ISO string
    let departureTimestamp = departureTime;
    if (typeof departureTime === 'string') {
        departureTimestamp = Math.floor(new Date(departureTime).getTime() / 1000);
    }

    // Build Google Directions API URL
    const params = new URLSearchParams({
        origin: origin,
        destination: destination,
        departure_time: departureTimestamp,
        traffic_model: trafficModel || 'best_guess',
        key: apiKey
    });

    const url = `https://maps.googleapis.com/maps/api/directions/json?${params}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== 'OK') {
            return res.status(400).json({
                error: `Google API error: ${data.status}`,
                details: data.error_message || 'No route found'
            });
        }

        // Extract the duration with traffic
        const leg = data.routes[0]?.legs[0];
        if (!leg) {
            return res.status(400).json({ error: 'No route found' });
        }

        const duration = leg.duration_in_traffic?.value || leg.duration?.value;

        return res.status(200).json({
            duration: duration,
            durationText: leg.duration_in_traffic?.text || leg.duration?.text,
            distance: leg.distance?.value,
            distanceText: leg.distance?.text
        });

    } catch (error) {
        console.error('Directions API error:', error);
        return res.status(500).json({ error: 'Failed to fetch directions' });
    }
}
