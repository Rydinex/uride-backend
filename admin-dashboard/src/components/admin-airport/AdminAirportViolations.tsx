"use client";

import { useEffect, useState } from "react";
import type { AirportViolation } from "@/app/lib/adminAirportApi";
import { fetchAirportViolations } from "@/app/lib/adminAirportApi";

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString();
}

export default function AdminAirportViolations() {
  const [violations, setViolations] = useState<AirportViolation[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadViolations = async () => {
      try {
        const payload = await fetchAirportViolations();

        if (!isMounted) {
          return;
        }

        setViolations(Array.isArray(payload) ? payload : []);
        setError("");
      } catch (requestError: unknown) {
        if (!isMounted) {
          return;
        }

        const message = requestError instanceof Error ? requestError.message : "Failed to load airport violations.";
        setError(message);
      }
    };

    loadViolations();
    const intervalId = window.setInterval(loadViolations, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="space-y-3">
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      {violations.map(violation => (
        <article key={violation.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-neutral-900">{violation.incidentType}</h2>
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
              {violation.severity}
            </span>
          </div>

          <p className="mt-2 text-sm text-neutral-700">{violation.description}</p>

          <div className="mt-3 text-xs text-neutral-600">
            <p>Driver: {violation.driverName || "Unknown"}</p>
            <p>Driver ID: {violation.driverId || "-"}</p>
            <p>Created: {formatDateTime(violation.createdAt)}</p>
          </div>
        </article>
      ))}

      {!error && violations.length === 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
          No open airport queue violations.
        </div>
      )}
    </div>
  );
}
