import type { Metadata } from "next";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";

export const metadata: Metadata = {
  title: "Keepsake analytics",
  description: "Anonymous, aggregate usage metrics for Keepsake.",
};

export default function AnalyticsPage() {
  return <AnalyticsDashboard />;
}
