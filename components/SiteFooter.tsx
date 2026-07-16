"use client";

import { useEffect, useState } from "react";
import { ShieldIcon } from "./Icons";
import Link from "next/link";
import { trackAnalytics } from "@/lib/analytics";

const ANALYTICS_ENDPOINT = "/.netlify/functions/analytics";
const CLAP_SESSION_KEY = "keepsake-clapped";

export default function SiteFooter() {
  const [claps, setClaps] = useState<number | null>(null);
  const [clapped, setClapped] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      try { setClapped(sessionStorage.getItem(CLAP_SESSION_KEY) === "1"); } catch { /* Storage is optional. */ }
    });
    fetch(ANALYTICS_ENDPOINT, { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ claps?: number }> : null)
      .then((totals) => { if (totals) setClaps(typeof totals.claps === "number" ? totals.claps : 0); })
      .catch(() => undefined);
  }, []);

  const clap = () => {
    if (clapped) return;
    setClapped(true);
    setClaps((count) => (count ?? 0) + 1);
    try { sessionStorage.setItem(CLAP_SESSION_KEY, "1"); } catch { /* Storage is optional. */ }
    trackAnalytics({ event: "clap" });
  };

  return (
    <footer>
      <div className="footer-moment">
        <span>Made for quiet moments. Clap if you loved it.</span>
        <button type="button" className={`clap-button${clapped ? " is-clapped" : ""}`} onClick={clap} disabled={clapped} aria-label={clapped ? `Clapped. ${claps ?? 1} total claps` : "Clap for Keepsake"}>
          <span aria-hidden="true">👏</span> {clapped ? "Clapped" : "Clap"}{claps !== null ? ` · ${claps}` : ""}
        </button>
      </div>
      <div className="footer-credit">
        <small>Created by</small>
        <strong>Manish Sharma</strong>
        <a href="https://manish-luci.netlify.app" target="_blank" rel="noreferrer">View portfolio ↗</a>
      </div>
      <span className="footer-privacy"><ShieldIcon /> Private by design · <Link href="/analytics">Analytics</Link></span>
    </footer>
  );
}
