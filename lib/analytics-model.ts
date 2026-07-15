import type { Difficulty } from "./types";

export type AnalyticsEvent =
  | { event: "session_started" }
  | { event: "photo_selected" }
  | { event: "puzzle_started"; difficulty: Difficulty; pieces: number }
  | { event: "piece_placed" }
  | { event: "hint_used" }
  | { event: "puzzle_completed"; elapsedSeconds?: number };

export type DailyAnalytics = {
  sessions: number;
  started: number;
  completed: number;
};

export type AnalyticsTotals = {
  version: 1;
  updatedAt: string | null;
  sessions: number;
  photosSelected: number;
  puzzlesStarted: number;
  piecesPlaced: number;
  hintsUsed: number;
  puzzlesCompleted: number;
  timedCompletions: number;
  completionSecondsTotal: number;
  difficulty: Record<Difficulty, number>;
  pieceCounts: Record<string, number>;
  daily: Record<string, DailyAnalytics>;
};

export function emptyAnalytics(): AnalyticsTotals {
  return {
    version: 1,
    updatedAt: null,
    sessions: 0,
    photosSelected: 0,
    puzzlesStarted: 0,
    piecesPlaced: 0,
    hintsUsed: 0,
    puzzlesCompleted: 0,
    timedCompletions: 0,
    completionSecondsTotal: 0,
    difficulty: { easy: 0, medium: 0, hard: 0 },
    pieceCounts: {},
    daily: {},
  };
}

export function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  if (!value || typeof value !== "object" || !("event" in value)) return false;
  const candidate = value as Record<string, unknown>;
  const hasOnly = (...keys: string[]) => Object.keys(candidate).every((key) => keys.includes(key));
  switch (candidate.event) {
    case "session_started":
    case "photo_selected":
    case "piece_placed":
    case "hint_used":
      return hasOnly("event");
    case "puzzle_started":
      return hasOnly("event", "difficulty", "pieces") &&
        ["easy", "medium", "hard"].includes(String(candidate.difficulty)) &&
        typeof candidate.pieces === "number" &&
        Number.isInteger(candidate.pieces) &&
        candidate.pieces >= 8 &&
        candidate.pieces <= 150;
    case "puzzle_completed":
      return hasOnly("event", "elapsedSeconds") &&
        (candidate.elapsedSeconds === undefined ||
        (typeof candidate.elapsedSeconds === "number" &&
          Number.isFinite(candidate.elapsedSeconds) &&
          candidate.elapsedSeconds >= 0 &&
          candidate.elapsedSeconds <= 86_400));
    default:
      return false;
  }
}

export function applyAnalyticsEvent(
  current: AnalyticsTotals,
  event: AnalyticsEvent,
  now = new Date(),
): AnalyticsTotals {
  const day = now.toISOString().slice(0, 10);
  const next: AnalyticsTotals = {
    ...current,
    updatedAt: now.toISOString(),
    difficulty: { ...current.difficulty },
    pieceCounts: { ...current.pieceCounts },
    daily: { ...current.daily },
  };
  const daily = { ...(next.daily[day] ?? { sessions: 0, started: 0, completed: 0 }) };

  switch (event.event) {
    case "session_started":
      next.sessions += 1;
      daily.sessions += 1;
      break;
    case "photo_selected":
      next.photosSelected += 1;
      break;
    case "puzzle_started":
      next.puzzlesStarted += 1;
      next.difficulty[event.difficulty] += 1;
      next.pieceCounts[String(event.pieces)] = (next.pieceCounts[String(event.pieces)] ?? 0) + 1;
      daily.started += 1;
      break;
    case "piece_placed":
      next.piecesPlaced += 1;
      break;
    case "hint_used":
      next.hintsUsed += 1;
      break;
    case "puzzle_completed":
      next.puzzlesCompleted += 1;
      daily.completed += 1;
      if (event.elapsedSeconds !== undefined) {
        next.timedCompletions += 1;
        next.completionSecondsTotal += Math.round(event.elapsedSeconds);
      }
      break;
  }
  next.daily[day] = daily;

  const retainedDays = Object.keys(next.daily).sort().slice(-90);
  next.daily = Object.fromEntries(retainedDays.map((key) => [key, next.daily[key]]));
  return next;
}
