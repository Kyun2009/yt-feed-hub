const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2/options");
const { defineSecret } = require("firebase-functions/params");
const cors = require("cors")({ origin: true });

setGlobalOptions({ region: "asia-northeast3" });

const YT_API_BASE = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_API_KEY = defineSecret("YOUTUBE_API_KEY");

function safeInt(value) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildPublishedAfter(period) {
  const now = new Date();
  let start;
  if (period === "today") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === "30d") {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  return start.toISOString();
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

exports.youtubeIssue = onRequest({ secrets: [YOUTUBE_API_KEY] }, async (req, res) => {
  cors(req, res, async () => {
    res.set("Cache-Control", "public, max-age=120");

    const apiKey = process.env.YOUTUBE_API_KEY || YOUTUBE_API_KEY.value();
    if (!apiKey) {
      res.status(500).json({ error: "Missing YOUTUBE_API_KEY." });
      return;
    }

    const period = String(req.query.period || "7d");
    const mode = String(req.query.mode || "hot");
    const region = String(req.query.region || "KR");
    const language = String(req.query.language || "ko");
    const categoryId = req.query.categoryId ? String(req.query.categoryId) : "";
    const minSubs = safeInt(req.query.minSubs);
    const maxSubs = safeInt(req.query.maxSubs);
    const excludeKeywords = String(req.query.excludeKeywords || "")
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean);

    const publishedAfter = buildPublishedAfter(period);
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
        res.json({ items: [], fetchedAt: new Date().toISOString() });
        return;
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
          uploadDate: snippet.publishedAt
            ? snippet.publishedAt.split("T")[0]
            : "",
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

      const periodDays = period === "today" ? 1 : period === "30d" ? 30 : 7;

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
            normalize(
              metrics.likeRate,
              ranges.likeRate.min,
              ranges.likeRate.max
            ) +
          0.2 * recencyBoost;
        const scoreStable =
          0.5 * normalize(metrics.views, ranges.views.min, ranges.views.max) +
          0.25 *
            normalize(metrics.likes, ranges.likes.min, ranges.likes.max) +
          0.15 *
            normalize(
              metrics.comments,
              ranges.comments.min,
              ranges.comments.max
            ) +
          0.1 *
            normalize(
              metrics.likeRate,
              ranges.likeRate.min,
              ranges.likeRate.max
            );

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
      res.json({ items, fetchedAt: now.toISOString() });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});
