const YT_API_BASE = "https://www.googleapis.com/youtube/v3";

function safeInt(value) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildPublishedAfter(period) {
  const now = new Date();
  const hoursMap = {
    today: 24,
    "3d": 24 * 3,
    "7d": 24 * 7,
    "30d": 24 * 30
  };
  const hours = hoursMap[period] || hoursMap["7d"];
  const start = new Date(now.getTime() - hours * 60 * 60 * 1000);
  return start.toISOString();
}

function buildPublishedAfterDate(period) {
  return new Date(buildPublishedAfter(period));
}

function isWithinPeriod(publishedAt, publishedAfterDate) {
  if (!publishedAt) return false;
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return false;
  return date >= publishedAfterDate;
}
function normalize(value, min, max) {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`YouTube API error: ${response.status} ${message}`);
  }
  return response.json();
}

function withCors(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "public, max-age=120",
      ...extraHeaders
    }
  });
}

export async function onRequest(context) {
  const request = context.request;
  const cacheEndpoint = context.env.CACHE_ENDPOINT || "";

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
    return withCors({ error: "Method not allowed" }, 405);
  }

  const apiKey = context.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return withCors({ error: "Missing YOUTUBE_API_KEY." }, 500);
  }

  const url = new URL(request.url);
  const period = url.searchParams.get("period") || "7d";
  const mode = url.searchParams.get("mode") || "hot";
  const region = url.searchParams.get("region") || "KR";
  const language = url.searchParams.get("language") || "ko";
  const categoryId = url.searchParams.get("categoryId") || "";
  const minSubs = safeInt(url.searchParams.get("minSubs"));
  const maxSubs = safeInt(url.searchParams.get("maxSubs"));
  const excludeKeywords = (url.searchParams.get("excludeKeywords") || "")
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  if (cacheEndpoint) {
    const cacheUrl = new URL(cacheEndpoint);
    cacheUrl.searchParams.set("period", period);
    cacheUrl.searchParams.set("mode", mode);
    try {
      const cachedResponse = await fetch(cacheUrl.toString());
      if (cachedResponse.ok) {
        const cachedData = await cachedResponse.json();
        console.log("cache hit", { period, mode, cacheUrl: cacheUrl.toString() });
        return withCors(
          { items: cachedData.items || [], fetchedAt: cachedData.fetchedAt || null },
          200,
          { "X-Cache": "HIT" }
        );
      }
      console.warn("cache miss", { period, mode, status: cachedResponse.status });
    } catch {
      console.warn("cache error", { period, mode, cacheUrl: cacheUrl.toString() });
      // Ignore cache errors and fall back to live fetch
    }
  }

  const publishedAfter = buildPublishedAfter(period);
  const publishedAfterDate = buildPublishedAfterDate(period);
  const searchParams = new URLSearchParams({
    key: apiKey,
    part: "snippet",
    type: "video",
    order: "date",
    maxResults: "50",
    publishedAfter,
    regionCode: region,
    relevanceLanguage: language
  });
  if (categoryId) {
    searchParams.set("videoCategoryId", categoryId);
  }

  try {
    const searchUrl = `${YT_API_BASE}/search?${searchParams.toString()}`;
    const searchData = await fetchJson(searchUrl);
    const videoIds = (searchData.items || [])
      .map((item) => item.id && item.id.videoId)
      .filter(Boolean);

    if (!videoIds.length) {
      const popularParams = new URLSearchParams({
        key: apiKey,
        part: "snippet,statistics,status,contentDetails",
        chart: "mostPopular",
        maxResults: "50",
        regionCode: region
      });
      if (categoryId) {
        popularParams.set("videoCategoryId", categoryId);
      }
      const popularUrl = `${YT_API_BASE}/videos?${popularParams.toString()}`;
      const popularData = await fetchJson(popularUrl);
      const popularItems = popularData.items || [];
      const recentPopularItems = popularItems.filter((video) =>
        isWithinPeriod(video.snippet && video.snippet.publishedAt, publishedAfterDate)
      );

      if (!recentPopularItems.length) {
        return withCors(
          { items: [], fetchedAt: new Date().toISOString() },
          200,
          { "X-Cache": "MISS" }
        );
      }

      const now = new Date();
      let items = recentPopularItems.map((video) => {
        const snippet = video.snippet || {};
        const statistics = video.statistics || {};
        const status = video.status || {};
        const publishedAt = snippet.publishedAt
          ? new Date(snippet.publishedAt)
          : now;
        const daysSince = Math.max(
          1,
          (now.getTime() - publishedAt.getTime()) / (24 * 60 * 60 * 1000)
        );

        const views = safeInt(statistics.viewCount);
        const likes = safeInt(statistics.likeCount);
        const comments = safeInt(statistics.commentCount);
        const likeRate = likes / Math.max(views, 1);
        const viewVelocity = views / daysSince;

        return {
          id: video.id,
          title: snippet.title || "",
          channel: snippet.channelTitle || "",
          thumbnail:
            (snippet.thumbnails &&
              (snippet.thumbnails.medium || snippet.thumbnails.default) &&
              (snippet.thumbnails.medium || snippet.thumbnails.default).url) ||
            "",
          uploadDate: snippet.publishedAt
            ? snippet.publishedAt.split("T")[0]
            : "",
          publishedAt: snippet.publishedAt || "",
          metrics: {
            views,
            likes,
            comments,
            likeRate,
            viewVelocity,
            subscribers: 0,
            daysSince
          },
          status: {
            privacyStatus: status.privacyStatus,
            uploadStatus: status.uploadStatus,
            embeddable: status.embeddable
          },
          description: snippet.description || ""
        };
      });

      items = items.filter((item) =>
        isWithinPeriod(item.publishedAt, publishedAfterDate)
      );

      items = items.filter((item) => {
        const status = item.status || {};
        return (
          status.privacyStatus === "public" &&
          status.uploadStatus === "processed" &&
          status.embeddable !== false
        );
      });

      if (excludeKeywords.length) {
        items = items.filter((item) => {
          const text = `${item.title} ${item.description}`.toLowerCase();
          return !excludeKeywords.some((keyword) =>
            text.includes(keyword.toLowerCase())
          );
        });
      }

      const viewsValues = items.map((item) => item.metrics.views);
      const likesValues = items.map((item) => item.metrics.likes);
      const commentsValues = items.map((item) => item.metrics.comments);
      const likeRateValues = items.map((item) => item.metrics.likeRate);
      const velocityValues = items.map((item) => item.metrics.viewVelocity);

      const ranges = {
        views: {
          min: Math.min(...viewsValues, 0),
          max: Math.max(...viewsValues, 0)
        },
        likes: {
          min: Math.min(...likesValues, 0),
          max: Math.max(...likesValues, 0)
        },
        comments: {
          min: Math.min(...commentsValues, 0),
          max: Math.max(...commentsValues, 0)
        },
        likeRate: {
          min: Math.min(...likeRateValues, 0),
          max: Math.max(...likeRateValues, 0)
        },
        viewVelocity: {
          min: Math.min(...velocityValues, 0),
          max: Math.max(...velocityValues, 0)
        }
      };

      const periodDays =
        period === "today" ? 1 : period === "3d" ? 3 : period === "30d" ? 30 : 7;

      items = items.map((item) => {
        const metrics = item.metrics;
        const recencyBoost = 1 - Math.min(1, metrics.daysSince / periodDays);
        const scoreHot =
          0.45 *
            normalize(
              metrics.viewVelocity,
              ranges.viewVelocity.min,
              ranges.viewVelocity.max
            ) +
          0.2 *
            normalize(
              metrics.comments,
              ranges.comments.min,
              ranges.comments.max
            ) +
          0.15 *
            normalize(metrics.likeRate, ranges.likeRate.min, ranges.likeRate.max) +
          0.2 * recencyBoost;
        const scoreStable =
          0.5 * normalize(metrics.views, ranges.views.min, ranges.views.max) +
          0.25 * normalize(metrics.likes, ranges.likes.min, ranges.likes.max) +
          0.15 *
            normalize(
              metrics.comments,
              ranges.comments.min,
              ranges.comments.max
            ) +
          0.1 * normalize(metrics.likeRate, ranges.likeRate.min, ranges.likeRate.max);

        return {
          id: item.id,
          title: item.title,
          channel: item.channel,
          thumbnail: item.thumbnail,
          uploadDate: item.uploadDate,
          metrics: {
            views: metrics.views,
            likes: metrics.likes,
            comments: metrics.comments,
            likeRate: metrics.likeRate,
            viewVelocity: metrics.viewVelocity,
            subscribers: 0
          },
          score: mode === "stable" ? scoreStable : scoreHot
        };
      });

      items.sort((a, b) => b.score - a.score);
      return withCors({ items, fetchedAt: now.toISOString() }, 200, { "X-Cache": "MISS" });
    }

    const videosParams = new URLSearchParams({
      key: apiKey,
      part: "snippet,statistics,status,contentDetails",
      id: videoIds.join(","),
      maxResults: "50"
    });
    const videosUrl = `${YT_API_BASE}/videos?${videosParams.toString()}`;
    const videosData = await fetchJson(videosUrl);

    const channelIds = [
      ...new Set(
        (videosData.items || [])
          .map((video) => video.snippet && video.snippet.channelId)
          .filter(Boolean)
      )
    ];

    let channelMap = new Map();
    if (channelIds.length) {
      const channelsParams = new URLSearchParams({
        key: apiKey,
        part: "statistics,snippet",
        id: channelIds.join(","),
        maxResults: "50"
      });
      const channelsUrl = `${YT_API_BASE}/channels?${channelsParams.toString()}`;
      const channelsData = await fetchJson(channelsUrl);
      channelMap = new Map(
        (channelsData.items || []).map((channel) => [channel.id, channel])
      );
    }

    const now = new Date();
    let items = (videosData.items || []).map((video) => {
      const snippet = video.snippet || {};
      const statistics = video.statistics || {};
      const status = video.status || {};
      const channel = channelMap.get(snippet.channelId) || {};
      const channelStats = channel.statistics || {};
      const publishedAt = snippet.publishedAt
        ? new Date(snippet.publishedAt)
        : now;
      const daysSince = Math.max(
        1,
        (now.getTime() - publishedAt.getTime()) / (24 * 60 * 60 * 1000)
      );

      const views = safeInt(statistics.viewCount);
      const likes = safeInt(statistics.likeCount);
      const comments = safeInt(statistics.commentCount);
      const likeRate = likes / Math.max(views, 1);
      const viewVelocity = views / daysSince;
      const subscribers = safeInt(channelStats.subscriberCount);

      return {
        id: video.id,
        title: snippet.title || "",
        channel: snippet.channelTitle || "",
        thumbnail:
          (snippet.thumbnails &&
            (snippet.thumbnails.medium || snippet.thumbnails.default) &&
            (snippet.thumbnails.medium || snippet.thumbnails.default).url) ||
          "",
        uploadDate: snippet.publishedAt ? snippet.publishedAt.split("T")[0] : "",
        publishedAt: snippet.publishedAt || "",
        metrics: {
          views,
          likes,
          comments,
          likeRate,
          viewVelocity,
          subscribers,
          daysSince
        },
        status: {
          privacyStatus: status.privacyStatus,
          uploadStatus: status.uploadStatus,
          embeddable: status.embeddable
        },
        description: snippet.description || ""
      };
    });

    items = items.filter((item) =>
      isWithinPeriod(item.publishedAt, publishedAfterDate)
    );

    items = items.filter((item) => {
      const status = item.status || {};
      return (
        status.privacyStatus === "public" &&
        status.uploadStatus === "processed" &&
        status.embeddable !== false
      );
    });

    items = items.filter((item) => {
      if (minSubs && item.metrics.subscribers < minSubs) return false;
      if (maxSubs && item.metrics.subscribers > maxSubs) return false;
      return true;
    });

    if (excludeKeywords.length) {
      items = items.filter((item) => {
        const text = `${item.title} ${item.description}`.toLowerCase();
        return !excludeKeywords.some((keyword) =>
          text.includes(keyword.toLowerCase())
        );
      });
    }

    const viewsValues = items.map((item) => item.metrics.views);
    const likesValues = items.map((item) => item.metrics.likes);
    const commentsValues = items.map((item) => item.metrics.comments);
    const likeRateValues = items.map((item) => item.metrics.likeRate);
    const velocityValues = items.map((item) => item.metrics.viewVelocity);

    const ranges = {
      views: {
        min: Math.min(...viewsValues, 0),
        max: Math.max(...viewsValues, 0)
      },
      likes: {
        min: Math.min(...likesValues, 0),
        max: Math.max(...likesValues, 0)
      },
      comments: {
        min: Math.min(...commentsValues, 0),
        max: Math.max(...commentsValues, 0)
      },
      likeRate: {
        min: Math.min(...likeRateValues, 0),
        max: Math.max(...likeRateValues, 0)
      },
      viewVelocity: {
        min: Math.min(...velocityValues, 0),
        max: Math.max(...velocityValues, 0)
      }
    };

    const periodDays =
      period === "today" ? 1 : period === "3d" ? 3 : period === "30d" ? 30 : 7;

    items = items.map((item) => {
      const metrics = item.metrics;
      const recencyBoost = 1 - Math.min(1, metrics.daysSince / periodDays);
      const scoreHot =
        0.45 *
          normalize(
            metrics.viewVelocity,
            ranges.viewVelocity.min,
            ranges.viewVelocity.max
          ) +
        0.2 *
          normalize(metrics.comments, ranges.comments.min, ranges.comments.max) +
        0.15 * normalize(metrics.likeRate, ranges.likeRate.min, ranges.likeRate.max) +
        0.2 * recencyBoost;
      const scoreStable =
        0.5 * normalize(metrics.views, ranges.views.min, ranges.views.max) +
        0.25 * normalize(metrics.likes, ranges.likes.min, ranges.likes.max) +
        0.15 *
          normalize(metrics.comments, ranges.comments.min, ranges.comments.max) +
        0.1 * normalize(metrics.likeRate, ranges.likeRate.min, ranges.likeRate.max);

      return {
        id: item.id,
        title: item.title,
        channel: item.channel,
        thumbnail: item.thumbnail,
        uploadDate: item.uploadDate,
        metrics: {
          views: metrics.views,
          likes: metrics.likes,
          comments: metrics.comments,
          likeRate: metrics.likeRate,
          viewVelocity: metrics.viewVelocity,
          subscribers: metrics.subscribers
        },
        score: mode === "stable" ? scoreStable : scoreHot
      };
    });

    items.sort((a, b) => b.score - a.score);
    return withCors({ items, fetchedAt: now.toISOString() }, 200, { "X-Cache": "MISS" });
  } catch (error) {
    return withCors({ error: error.message }, 500);
  }
}
