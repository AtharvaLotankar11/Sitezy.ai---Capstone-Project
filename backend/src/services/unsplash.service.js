/**
 * unsplash.service.js
 * Centralized Unsplash API client.
 * Uses the Unsplash Access Key from environment variables.
 * Caches results in-process to avoid rate-limit hits (50 req/hr on demo tier).
 */

const UNSPLASH_BASE = "https://api.unsplash.com";
const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

// ─── In-memory cache (key → {url, thumb, timestamp}) ──────────────────────────
const imageCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Search Unsplash and return the best matching photo URL.
 *
 * @param {string} query      - Search query (e.g. "coffee barista")
 * @param {number} width      - Desired image width
 * @param {number} height     - Desired image height
 * @param {"landscape"|"portrait"|"squarish"} orientation
 * @returns {Promise<{url: string, thumb: string, photographer: string, alt: string}>}
 */
export async function searchUnsplash(query, width = 800, height = 600, orientation = "landscape") {
    if (!ACCESS_KEY) {
        console.warn("[Unsplash] No access key configured. Falling back to static photo map.");
        return fallbackPhoto(query, width, height);
    }

    const cacheKey = `${query}__${width}x${height}`;
    const cached = imageCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached;
    }

    try {
        const params = new URLSearchParams({
            query,
            per_page: "5",
            orientation,
            content_filter: "high",
        });

        const response = await fetch(`${UNSPLASH_BASE}/search/photos?${params}`, {
            headers: {
                Authorization: `Client-ID ${ACCESS_KEY}`,
                "Accept-Version": "v1",
            },
        });

        if (!response.ok) {
            console.error(`[Unsplash] API error: ${response.status} ${response.statusText}`);
            return fallbackPhoto(query, width, height);
        }

        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            return fallbackPhoto(query, width, height);
        }

        // Pick the first high-quality result
        const photo = data.results[0];
        const url = buildUnsplashUrl(photo.urls.raw, width, height);
        const thumb = photo.urls.thumb;
        const photographer = photo.user?.name || "Unsplash";
        const alt = photo.alt_description || photo.description || query;

        const result = { url, thumb, photographer, alt, id: photo.id };
        imageCache.set(cacheKey, { ...result, timestamp: Date.now() });
        return result;

    } catch (err) {
        console.error("[Unsplash] Fetch error:", err.message);
        return fallbackPhoto(query, width, height);
    }
}

/**
 * Fetch multiple queries in parallel (with concurrency limit).
 * Returns a map of { query → {url, thumb} }
 */
export async function searchUnsplashBatch(queries, width = 800, height = 600) {
    const CONCURRENCY = 4;
    const results = {};
    const unique = [...new Set(queries.filter(Boolean))];

    for (let i = 0; i < unique.length; i += CONCURRENCY) {
        const batch = unique.slice(i, i + CONCURRENCY);
        const settled = await Promise.allSettled(
            batch.map(q => searchUnsplash(q, width, height))
        );
        settled.forEach((res, idx) => {
            results[batch[idx]] = res.status === "fulfilled"
                ? res.value
                : fallbackPhoto(batch[idx], width, height);
        });
    }

    return results;
}

/**
 * Build a correctly-sized URL from Unsplash raw URL.
 */
function buildUnsplashUrl(rawUrl, width, height) {
    if (!rawUrl) return null;
    return `${rawUrl}&w=${width}&h=${height}&fit=crop&auto=format&q=80`;
}

// ─── Static fallback map (used when no API key or request fails) ───────────────
const FALLBACK_PHOTO_MAP = {
    coffee: "photo-1495474472287-4d71bcdd2085",
    latte: "photo-1541167760496-1628856ab772",
    barista: "photo-1501339847302-ac426a4a7cbb",
    cafe: "photo-1559925393-8be0ec4767c8",
    espresso: "photo-1510591509098-f4fdc6d0ff04",
    restaurant: "photo-1414235077428-338989a2e8c0",
    food: "photo-1504674900247-0877df9cc836",
    chef: "photo-1577219491135-ce391730fb2c",
    dining: "photo-1517248135467-4c7edcad34c4",
    gourmet: "photo-1555939594-58d7cb561ad1",
    bakery: "photo-1509440159596-0249088772ff",
    fitness: "photo-1534438327276-14e5300c3a48",
    gym: "photo-1571019613454-1cb2f99b2d8b",
    yoga: "photo-1593810450967-f9c42742e326",
    workout: "photo-1517836357463-d25dfeac3438",
    athlete: "photo-1552674605-db6ffd4facb5",
    tech: "photo-1496181133206-80ce9b88a853",
    startup: "photo-1497366216548-37526070297c",
    developer: "photo-1517180102446-f3ece451e9d8",
    code: "photo-1555066931-4365d14bab8c",
    software: "photo-1518770660439-4636190af475",
    fashion: "photo-1558769132-cb1aea458c5e",
    clothing: "photo-1445205170230-053b83016050",
    model: "photo-1496747611176-843222e1e57c",
    luxury: "photo-1515886657613-9f3515b0c78f",
    medical: "photo-1576091160550-2173dba999ef",
    doctor: "photo-1559839734-2b71ea197ec2",
    healthcare: "photo-1519494026892-80bbd2d6fd0d",
    clinic: "photo-1538108149393-fbbd82ab8c59",
    home: "photo-1568605114967-8130f3a36994",
    interior: "photo-1616486338812-3dadae4b4ace",
    architecture: "photo-1486325212027-8081e485255e",
    property: "photo-1600585154340-be6161a56a0c",
    beauty: "photo-1522337360788-8b13dee7a37e",
    spa: "photo-1519823551278-64ac92734fb1",
    skincare: "photo-1570172619644-dfd03ed5d881",
    salon: "photo-1562322140-8baeececf3df",
    makeup: "photo-1487412840662-9f0b5e0bc9ab",
    travel: "photo-1488646953014-85cb44e25828",
    beach: "photo-1507525428034-b723cf961d3e",
    mountain: "photo-1464822759023-fed622ff2c3b",
    hotel: "photo-1566073771259-6a8506099945",
    law: "photo-1589829545856-d10d557cf95f",
    legal: "photo-1568027762272-e4da8b386fe9",
    finance: "photo-1611974789855-9c2a0a7236a3",
    business: "photo-1507679799987-c73779587ccf",
    corporate: "photo-1497366754035-f200968a6e72",
    office: "photo-1497366811353-6870744d04b2",
    meeting: "photo-1552664730-d307ca884978",
    creative: "photo-1558618666-fcd25c85cd64",
    design: "photo-1561070791-2526d30994b5",
    art: "photo-1579783902614-a3fb3927b6a5",
    studio: "photo-1531746020798-e6953c6e8e04",
    education: "photo-1509062522246-3755977927d7",
    professional: "photo-1521737711867-e3b97375f902",
    team: "photo-1522071820081-009f0129c71c",
    workspace: "photo-1497366216548-37526070297c",
    abstract: "photo-1557683316-973673baf926",
    nature: "photo-1501854140801-50d01698950b",
    city: "photo-1477959858617-67f85cf4f1df",
};

function fallbackPhoto(query, width, height) {
    const q = (query || "").toLowerCase();
    const matchedKey = Object.keys(FALLBACK_PHOTO_MAP).find(k => q.includes(k));
    const photoId = matchedKey
        ? FALLBACK_PHOTO_MAP[matchedKey]
        : FALLBACK_PHOTO_MAP.professional;

    const url = `https://images.unsplash.com/${photoId}?w=${width}&h=${height}&fit=crop&auto=format&q=80`;
    return { url, thumb: url, photographer: "Unsplash", alt: query, id: photoId };
}
