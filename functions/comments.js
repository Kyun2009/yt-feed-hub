const YT_API_BASE = "https://www.googleapis.com/youtube/v3";

function withCors(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "public, max-age=3600",
      ...extraHeaders
    }
  });
}

function sanitizeComment(text) {
  if (!text) return "";
  const trimmed = text.trim();
  if (!trimmed) return "";

  const lowered = trimmed.toLowerCase();
  const blocked = [
    "시발",
    "씨발",
    "ㅅㅂ",
    "병신",
    "좆",
    "fuck",
    "shit",
    "asshole",
    "bitch",
    "nazi"
  ];
  if (blocked.some((word) => lowered.includes(word))) return "";

  const withoutLinks = trimmed.replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim();
  if (!withoutLinks) return "";
  return withoutLinks.slice(0, 160);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`YouTube API error: ${response.status} ${message}`);
  }
  return response.json();
}

async function fetchTopComment(videoId, apiKey) {
  const params = new URLSearchParams({
    key: apiKey,
    part: "snippet",
    videoId,
    maxResults: "1",
    order: "relevance",
    textFormat: "plainText"
  });
  const url = `${YT_API_BASE}/commentThreads?${params.toString()}`;
  const data = await fetchJson(url);
  const item = (data.items || [])[0];
  const snippet = item?.snippet?.topLevelComment?.snippet;
  const text = snippet?.textDisplay || "";
  return sanitizeComment(text);
}

export async function onRequest(context) {
  const request = context.request;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400"
      }
    });
  }

  if (request.method !== "GET") {
    return withCors({ comment: "" }, 405);
  }

  const apiKey = context.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return withCors({ comment: "" }, 500);
  }

  const url = new URL(request.url);
  const videoId = url.searchParams.get("videoId") || "";
  if (!videoId) {
    return withCors({ comment: "" }, 400);
  }

  try {
    const cacheKey = new Request(url.toString(), request);
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const comment = await fetchTopComment(videoId, apiKey);
    const response = withCors({ comment });
    await cache.put(cacheKey, response.clone());
    return response;
  } catch {
    return withCors({ comment: "" }, 200);
  }
}
