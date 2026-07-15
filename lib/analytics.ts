"use client";

import type { AnalyticsEvent } from "./analytics-model";

const ENDPOINT = "/.netlify/functions/analytics";

export function trackAnalytics(event: AnalyticsEvent) {
  const body = JSON.stringify(event);
  try {
    if (navigator.sendBeacon) {
      const queued = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
      if (queued) return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // Analytics must never interrupt or degrade puzzle play.
  }
}
