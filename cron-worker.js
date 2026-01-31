const DEFAULT_SOURCE_API = "https://yt-feed-hub.pages.dev/api";
const PERIODS = ["today", "3d", "7d", "30d"];
const MODES = ["hot", "stable"];
const CACHE_TTL_SECONDS = 4 * 60 * 60 + 300;

async function fetchAndCache(env, period, mode) {
  const baseUrl = env.SOURCE_API_ENDPOINT || DEFAULT_SOURCE_API;
  const url = new URL(baseUrl);
  url.searchParams.set("period", period);
  url.searchParams.set("mode", mode);
  url.searchParams.set("language", env.DEFAULT_LANGUAGE || "ko");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Source API error: ${response.status}`);
  }
  const data = await response.json();
  const payload = JSON.stringify({
    items: data.items || [],
    fetchedAt: new Date().toISOString(),
    period,
    mode
  });

  await env.YT_CACHE.put(`cache:${period}:${mode}`, payload, {
    expirationTtl: CACHE_TTL_SECONDS
  });
}

async function handleApiRequest(request, env) {
  const url = new URL(request.url);
  const period = url.searchParams.get("period") || "7d";
  const mode = url.searchParams.get("mode") || "hot";
  const cached = await env.YT_CACHE.get(`cache:${period}:${mode}`);

  if (!cached) {
    return new Response(JSON.stringify({ items: [], fetchedAt: null }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  return new Response(cached, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=120"
    }
  });
}

export default {
  async scheduled(event, env, ctx) {
    console.log("cron fired", new Date().toISOString());
    const tasks = [];
    for (const period of PERIODS) {
      for (const mode of MODES) {
        tasks.push(fetchAndCache(env, period, mode));
      }
    }
    ctx.waitUntil(Promise.allSettled(tasks));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api")) {
      return handleApiRequest(request, env);
    }
    return new Response("Not Found", { status: 404 });
  }
};
