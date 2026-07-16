import type { Difficulty } from "./types";

export type AnalyticsEvent =
  | { event: "session_started" }
  | { event: "engaged_5m" }
  | { event: "clap" }
  | { event: "photo_selected" }
  | { event: "puzzle_started"; difficulty: Difficulty; pieces: number }
  | { event: "piece_placed" }
  | { event: "hint_used" }
  | { event: "puzzle_completed"; elapsedSeconds?: number };

export type DailyAnalytics = {
  sessions: number;
  engaged: number;
  claps: number;
  started: number;
  completed: number;
};

export type AnalyticsTotals = {
  version: 2;
  updatedAt: string | null;
  sessions: number;
  engagedFiveMinutes: number;
  claps: number;
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
    version: 2,
    updatedAt: null,
    sessions: 0,
    engagedFiveMinutes: 0,
    claps: 0,
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

function safeCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

export function normalizeAnalytics(value: unknown): AnalyticsTotals {
  const empty = emptyAnalytics();
  if (!value || typeof value !== "object") return empty;
  const source = value as Partial<AnalyticsTotals>;
  const sourceDifficulty = (source.difficulty ?? {}) as Partial<Record<Difficulty, number>>;
  const sourcePieceCounts = source.pieceCounts && typeof source.pieceCounts === "object" ? source.pieceCounts : {};
  const sourceDaily = source.daily && typeof source.daily === "object" ? source.daily : {};
  return {
    ...empty,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : null,
    sessions: safeCount(source.sessions),
    engagedFiveMinutes: safeCount(source.engagedFiveMinutes),
    claps: safeCount(source.claps),
    photosSelected: safeCount(source.photosSelected),
    puzzlesStarted: safeCount(source.puzzlesStarted),
    piecesPlaced: safeCount(source.piecesPlaced),
    hintsUsed: safeCount(source.hintsUsed),
    puzzlesCompleted: safeCount(source.puzzlesCompleted),
    timedCompletions: safeCount(source.timedCompletions),
    completionSecondsTotal: safeCount(source.completionSecondsTotal),
    difficulty: {
      easy: safeCount(sourceDifficulty.easy),
      medium: safeCount(sourceDifficulty.medium),
      hard: safeCount(sourceDifficulty.hard),
    },
    pieceCounts: Object.fromEntries(
      Object.entries(sourcePieceCounts).map(([key, count]) => [key, safeCount(count)]),
    ),
    daily: Object.fromEntries(
      Object.entries(sourceDaily).map(([day, value]) => {
        const counts = value && typeof value === "object" ? value as Partial<DailyAnalytics> : {};
        return [day, {
          sessions: safeCount(counts.sessions),
          engaged: safeCount(counts.engaged),
          claps: safeCount(counts.claps),
          started: safeCount(counts.started),
          completed: safeCount(counts.completed),
        }];
      }),
    ),
  };
}

export function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  if (!value || typeof value !== "object" || !("event" in value)) return false;
  const candidate = value as Record<string, unknown>;
  const hasOnly = (...keys: string[]) => Object.keys(candidate).every((key) => keys.includes(key));
  switch (candidate.event) {
    case "session_started":
    case "engaged_5m":
    case "clap":
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
  const normalized = normalizeAnalytics(current);
  const day = now.toISOString().slice(0, 10);
  const next: AnalyticsTotals = {
    ...normalized,
    updatedAt: now.toISOString(),
    difficulty: { ...normalized.difficulty },
    pieceCounts: { ...normalized.pieceCounts },
    daily: { ...normalized.daily },
  };
  const daily = { ...(next.daily[day] ?? { sessions: 0, engaged: 0, claps: 0, started: 0, completed: 0 }) };

  switch (event.event) {
    case "session_started":
      next.sessions += 1;
      daily.sessions += 1;
      break;
    case "engaged_5m":
      next.engagedFiveMinutes += 1;
      daily.engaged += 1;
      break;
    case "clap":
      next.claps += 1;
      daily.claps += 1;
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
