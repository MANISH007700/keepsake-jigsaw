import { getStore } from "@netlify/blobs";
import {
  applyAnalyticsEvent,
  emptyAnalytics,
  isAnalyticsEvent,
  type AnalyticsTotals,
} from "../../lib/analytics-model";

const STORE_NAME = "keepsake-analytics";
const TOTALS_KEY = "totals";
const responseHeaders = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

async function readTotals() {
  const store = getStore(STORE_NAME);
  const entry = await store.getWithMetadata(TOTALS_KEY, {
    consistency: "strong",
    type: "json",
  });
  return { store, entry };
}

async function recordEvent(event: Parameters<typeof applyAnalyticsEvent>[1]) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { store, entry } = await readTotals();
    const current = entry?.data as AnalyticsTotals | undefined;
    const next = applyAnalyticsEvent(current ?? emptyAnalytics(), event);
    const result = await store.setJSON(
      TOTALS_KEY,
      next,
      entry ? { onlyIfMatch: entry.etag } : { onlyIfNew: true },
    );
    if (result.modified) return next;
  }
  throw new Error("Analytics counter contention exceeded retry budget.");
}

const handler = async (request: Request) => {
  if (request.method === "GET") {
    const { entry } = await readTotals();
    return new Response(JSON.stringify(entry?.data ?? emptyAnalytics()), { headers: responseHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...responseHeaders, allow: "GET, POST" },
    });
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new Response(JSON.stringify({ error: "Cross-origin requests are not accepted" }), {
      status: 403,
      headers: responseHeaders,
    });
  }

  try {
    const body: unknown = await request.json();
    if (!isAnalyticsEvent(body)) {
      return new Response(JSON.stringify({ error: "Invalid analytics event" }), {
        status: 400,
        headers: responseHeaders,
      });
    }
    await recordEvent(body);
    return new Response(JSON.stringify({ recorded: true }), { status: 202, headers: responseHeaders });
  } catch (error) {
    console.error("Analytics write failed", error);
    return new Response(JSON.stringify({ error: "Analytics are temporarily unavailable" }), {
      status: 503,
      headers: responseHeaders,
    });
  }
};

export default handler;
