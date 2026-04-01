"use client";

import { useEffect, useState } from "react";
import type { AirportCode, AirportSummaryResponse } from "@/app/lib/adminAirportApi";
import { fetchAirportSummary } from "@/app/lib/adminAirportApi";

const airportCodes: AirportCode[] = ["ORD", "MDW"];

export default function AdminAirportOverview() {
  const [summary, setSummary] = useState<AirportSummaryResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadSummary = async () => {
      try {
        const payload = await fetchAirportSummary();
        if (isMounted) {
          setSummary(payload);
          setError("");
        }
      } catch (requestError: unknown) {
        if (isMounted) {
          const message = requestError instanceof Error ? requestError.message : "Failed to load airport summary.";
          setError(message);
        }
      }
    };

    loadSummary();
    const intervalId = window.setInterval(loadSummary, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  if (error) {
    return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>;
  }

  if (!summary) {
    return <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">Loading airport summary...</div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {airportCodes.map(code => (
        <section key={code} className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-neutral-900">{code}</h2>
          <div className="mt-3 grid gap-2 text-sm text-neutral-700">
            <p>Standard queue: {summary[code]?.standardQueue ?? 0}</p>
            <p>Black queue: {summary[code]?.blackQueue ?? 0}</p>
            <p>Drivers in staging: {summary[code]?.driversInStaging ?? 0}</p>
            <p>Active trips: {summary[code]?.activeTrips ?? 0}</p>
          </div>
        </section>
      ))}
    </div>
  );
}
