import { ShieldIcon } from "./Icons";
import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer>
      <span>Made for quiet moments.</span>
      <div className="footer-credit">
        <small>Created by</small>
        <strong>Manish Sharma</strong>
        <a href="https://github.com/MANISH007700" target="_blank" rel="noreferrer">View portfolio ↗</a>
      </div>
      <span className="footer-privacy"><ShieldIcon /> Private by design · <Link href="/analytics">Analytics</Link></span>
    </footer>
  );
}
