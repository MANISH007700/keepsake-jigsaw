"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteFooter from "./SiteFooter";
import { ShieldIcon } from "./Icons";
import { emptyAnalytics, normalizeAnalytics, type AnalyticsTotals } from "@/lib/analytics-model";

const ENDPOINT = "/.netlify/functions/analytics";

function formatDuration(seconds: number) {
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  return `${minutes}:${String(rounded % 60).padStart(2, "0")}`;
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsTotals>(emptyAnalytics());
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch(ENDPOINT, { cache: "no-store" });
      if (!response.ok) throw new Error("Analytics endpoint unavailable");
      setData(normalizeAnalytics(await response.json()));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch(ENDPOINT, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Analytics endpoint unavailable");
        return response.json() as Promise<AnalyticsTotals>;
      })
      .then((analytics) => {
        if (!active) return;
        setData(normalizeAnalytics(analytics));
        setStatus("ready");
      })
      .catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, []);

  const completionRate = data.puzzlesStarted > 0
    ? (data.puzzlesCompleted / data.puzzlesStarted) * 100
    : 0;
  const fiveMinuteRate = data.sessions > 0
    ? (data.engagedFiveMinutes / data.sessions) * 100
    : 0;
  const averageTime = data.timedCompletions > 0
    ? data.completionSecondsTotal / data.timedCompletions
    : 0;
  const daily = useMemo(() => Object.entries(data.daily).sort(([a], [b]) => a.localeCompare(b)).slice(-14), [data.daily]);
  const dailyMax = Math.max(1, ...daily.flatMap(([, values]) => [values.sessions, values.started, values.completed]));
  const difficultyMax = Math.max(1, ...Object.values(data.difficulty));
  const pieceMix = Object.entries(data.pieceCounts).sort(([a], [b]) => Number(a) - Number(b));
  const pieceMax = Math.max(1, ...pieceMix.map(([, value]) => value));

  return (
    <main className="analytics-shell">
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="Back to Keepsake">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span>
          <span>Keepsake</span>
        </Link>
        <Link className="text-button" href="/">Open puzzle</Link>
      </header>

      <section className="analytics-page">
        <div className="analytics-heading">
          <div>
            <span className="eyebrow eyebrow-accent">Anonymous product analytics</span>
            <h1>How Keepsake is being played.</h1>
            <p>Aggregate counts only. No image, filename, persistent user ID, or personal information is collected.</p>
          </div>
          <button className="button button-quiet" onClick={() => void load()} disabled={status === "loading"}>
            {status === "loading" ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {status === "error" ? (
          <div className="analytics-empty" role="alert">
            <h2>Analytics will appear after Netlify deployment.</h2>
            <p>The dashboard needs the included Netlify Function and Blobs store. Puzzle play remains fully available without it.</p>
            <button className="button button-primary" onClick={() => void load()}>Try again</button>
          </div>
        ) : (
          <>
            <div className="metric-grid" aria-busy={status === "loading"}>
              <MetricCard label="Visits" value={data.sessions} note="Page visits, not unique people" />
              <MetricCard label="Stayed 5+ min" value={data.engagedFiveMinutes} note={`${fiveMinuteRate.toFixed(1)}% of visits · active time`} accent />
              <MetricCard label="Claps" value={data.claps} note="One per browser session" />
              <MetricCard label="Puzzles started" value={data.puzzlesStarted} note="Includes re-scrambles" />
              <MetricCard label="Puzzles completed" value={data.puzzlesCompleted} note="Last piece successfully placed" />
              <MetricCard label="Completion rate" value={`${completionRate.toFixed(1)}%`} note="Completed ÷ started" />
              <MetricCard label="Photos selected" value={data.photosSelected} note="Only the action is counted" />
              <MetricCard label="Pieces placed" value={data.piecesPlaced} note="Successful snaps" />
              <MetricCard label="Hints used" value={data.hintsUsed} note="Across all difficulty levels" />
              <MetricCard label="Average solve time" value={data.timedCompletions ? formatDuration(averageTime) : "—"} note="Timed completions only" />
            </div>

            <div className="analytics-grid">
              <section className="analytics-card analytics-card-wide">
                <div className="analytics-card-heading"><div><span className="eyebrow">Last 14 active days</span><h2>Play activity</h2></div><span className="legend"><i className="sessions" /> Visits <i className="starts" /> Starts <i className="completes" /> Completed</span></div>
                {daily.length ? (
                  <div className="daily-chart">
                    {daily.map(([date, values]) => (
                      <div className="day-column" key={date} title={`${date}: ${values.sessions} visits, ${values.started} starts, ${values.completed} completions`}>
                        <div className="day-bars"><i className="sessions" style={{ height: `${(values.sessions / dailyMax) * 100}%` }} /><i className="starts" style={{ height: `${(values.started / dailyMax) * 100}%` }} /><i className="completes" style={{ height: `${(values.completed / dailyMax) * 100}%` }} /></div>
                        <span>{date.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                ) : <EmptyBreakdown text="Activity will appear after the first visit." />}
              </section>

              <section className="analytics-card">
                <div className="analytics-card-heading"><div><span className="eyebrow">Challenge mix</span><h2>Difficulty</h2></div></div>
                <Breakdown rows={Object.entries(data.difficulty)} max={difficultyMax} />
              </section>

              <section className="analytics-card">
                <div className="analytics-card-heading"><div><span className="eyebrow">Puzzle size</span><h2>Piece-count mix</h2></div></div>
                {pieceMix.length ? <Breakdown rows={pieceMix} max={pieceMax} suffix=" pieces" /> : <EmptyBreakdown text="Puzzle starts will populate this mix." />}
              </section>
            </div>

            <section className="metric-notes">
              <ShieldIcon />
              <div><strong>Privacy guardrail</strong><p>Events contain only an action name and, when relevant, difficulty, piece count, or solve duration. Aggregates are stored in Netlify Blobs; photo bytes and filenames never enter analytics.</p></div>
              <span>Updated {data.updatedAt ? new Date(data.updatedAt).toLocaleString() : "after the first event"}</span>
            </section>
          </>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}

function MetricCard({ label, value, note, accent = false }: { label: string; value: string | number; note: string; accent?: boolean }) {
  return <article className={`metric-card${accent ? " is-accent" : ""}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function Breakdown({ rows, max, suffix = "" }: { rows: [string, number][]; max: number; suffix?: string }) {
  return <div className="breakdown-list">{rows.map(([label, value]) => <div className="breakdown-row" key={label}><div><span>{label}{suffix}</span><strong>{value}</strong></div><i><span style={{ width: `${(value / max) * 100}%` }} /></i></div>)}</div>;
}

function EmptyBreakdown({ text }: { text: string }) {
  return <div className="empty-breakdown">{text}</div>;
}
