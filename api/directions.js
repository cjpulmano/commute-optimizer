/**
 * Vercel Serverless Function: Directions API Proxy
 * Securely calls Google Directions API without exposing API key to clients
 */

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
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
