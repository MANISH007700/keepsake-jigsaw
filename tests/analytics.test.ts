import { describe, expect, it } from "vitest";
import { applyAnalyticsEvent, emptyAnalytics, isAnalyticsEvent } from "@/lib/analytics-model";

describe("analytics model", () => {
  it("tracks the core play funnel and diagnostic dimensions", () => {
    const date = new Date("2026-07-16T12:00:00.000Z");
    let totals = applyAnalyticsEvent(emptyAnalytics(), { event: "session_started" }, date);
    totals = applyAnalyticsEvent(totals, { event: "photo_selected" }, date);
    totals = applyAnalyticsEvent(totals, { event: "puzzle_started", difficulty: "hard", pieces: 30 }, date);
    totals = applyAnalyticsEvent(totals, { event: "piece_placed" }, date);
    totals = applyAnalyticsEvent(totals, { event: "hint_used" }, date);
    totals = applyAnalyticsEvent(totals, { event: "puzzle_completed", elapsedSeconds: 92.4 }, date);

    expect(totals).toMatchObject({
      sessions: 1,
      photosSelected: 1,
      puzzlesStarted: 1,
      piecesPlaced: 1,
      hintsUsed: 1,
      puzzlesCompleted: 1,
      timedCompletions: 1,
      completionSecondsTotal: 92,
      difficulty: { easy: 0, medium: 0, hard: 1 },
      pieceCounts: { "30": 1 },
      daily: { "2026-07-16": { sessions: 1, started: 1, completed: 1 } },
    });
  });

  it("rejects malformed or privacy-expanding event payloads", () => {
    expect(isAnalyticsEvent({ event: "puzzle_started", difficulty: "easy", pieces: 12 })).toBe(true);
    expect(isAnalyticsEvent({ event: "puzzle_started", difficulty: "easy", pieces: 999 })).toBe(false);
    expect(isAnalyticsEvent({ event: "photo_selected", filename: "private.png" })).toBe(false);
    expect(isAnalyticsEvent({ event: "unknown" })).toBe(false);
  });

  it("retains only the most recent 90 active days", () => {
    let totals = emptyAnalytics();
    for (let day = 1; day <= 100; day += 1) {
      totals = applyAnalyticsEvent(totals, { event: "session_started" }, new Date(Date.UTC(2026, 0, day)));
    }
    expect(Object.keys(totals.daily)).toHaveLength(90);
  });
});
