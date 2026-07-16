import { describe, expect, it } from "vitest";
import { applyAnalyticsEvent, emptyAnalytics, isAnalyticsEvent, normalizeAnalytics } from "@/lib/analytics-model";

describe("analytics model", () => {
  it("tracks the core play funnel and diagnostic dimensions", () => {
    const date = new Date("2026-07-16T12:00:00.000Z");
    let totals = applyAnalyticsEvent(emptyAnalytics(), { event: "session_started" }, date);
    totals = applyAnalyticsEvent(totals, { event: "engaged_5m" }, date);
    totals = applyAnalyticsEvent(totals, { event: "clap" }, date);
    totals = applyAnalyticsEvent(totals, { event: "photo_selected" }, date);
    totals = applyAnalyticsEvent(totals, { event: "puzzle_started", difficulty: "hard", pieces: 30 }, date);
    totals = applyAnalyticsEvent(totals, { event: "piece_placed" }, date);
    totals = applyAnalyticsEvent(totals, { event: "hint_used" }, date);
    totals = applyAnalyticsEvent(totals, { event: "puzzle_completed", elapsedSeconds: 92.4 }, date);

    expect(totals).toMatchObject({
      sessions: 1,
      engagedFiveMinutes: 1,
      claps: 1,
      photosSelected: 1,
      puzzlesStarted: 1,
      piecesPlaced: 1,
      hintsUsed: 1,
      puzzlesCompleted: 1,
      timedCompletions: 1,
      completionSecondsTotal: 92,
      difficulty: { easy: 0, medium: 0, hard: 1 },
      pieceCounts: { "30": 1 },
      daily: { "2026-07-16": { sessions: 1, engaged: 1, claps: 1, started: 1, completed: 1 } },
    });
  });

  it("rejects malformed or privacy-expanding event payloads", () => {
    expect(isAnalyticsEvent({ event: "puzzle_started", difficulty: "easy", pieces: 12 })).toBe(true);
    expect(isAnalyticsEvent({ event: "engaged_5m" })).toBe(true);
    expect(isAnalyticsEvent({ event: "clap" })).toBe(true);
    expect(isAnalyticsEvent({ event: "clap", userId: "no-thanks" })).toBe(false);
    expect(isAnalyticsEvent({ event: "puzzle_started", difficulty: "easy", pieces: 999 })).toBe(false);
    expect(isAnalyticsEvent({ event: "photo_selected", filename: "private.png" })).toBe(false);
    expect(isAnalyticsEvent({ event: "unknown" })).toBe(false);
  });

  it("migrates stored version-one totals without losing existing counts", () => {
    const normalized = normalizeAnalytics({
      version: 1,
      updatedAt: "2026-07-15T10:00:00.000Z",
      sessions: 12,
      puzzlesStarted: 7,
      difficulty: { easy: 4, medium: 2, hard: 1 },
      daily: { "2026-07-15": { sessions: 12, started: 7, completed: 3 } },
    });

    expect(normalized).toMatchObject({
      version: 2,
      sessions: 12,
      engagedFiveMinutes: 0,
      claps: 0,
      puzzlesStarted: 7,
      difficulty: { easy: 4, medium: 2, hard: 1 },
      daily: { "2026-07-15": { sessions: 12, engaged: 0, claps: 0, started: 7, completed: 3 } },
    });
  });

  it("retains only the most recent 90 active days", () => {
    let totals = emptyAnalytics();
    for (let day = 1; day <= 100; day += 1) {
      totals = applyAnalyticsEvent(totals, { event: "session_started" }, new Date(Date.UTC(2026, 0, day)));
    }
    expect(Object.keys(totals.daily)).toHaveLength(90);
  });
});
