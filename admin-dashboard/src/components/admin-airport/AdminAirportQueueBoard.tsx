"use client";

import { useEffect, useState } from "react";
import type {
  AirportCode,
  QueueGroup,
  AirportQueueEntry,
  AirportStagingDriver,
} from "@/app/lib/adminAirportApi";
import { fetchAirportQueue, fetchAirportStagingDrivers } from "@/app/lib/adminAirportApi";

const airportCodes: AirportCode[] = ["ORD", "MDW"];
const queueGroups: QueueGroup[] = ["standard", "black"];

function formatTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleTimeString();
}

export default function AdminAirportQueueBoard() {
  const [airportCode, setAirportCode] = useState<AirportCode>("ORD");
  const [queueGroup, setQueueGroup] = useState<QueueGroup>("standard");
  const [queueEntries, setQueueEntries] = useState<AirportQueueEntry[]>([]);
  const [stagingDrivers, setStagingDrivers] = useState<AirportStagingDriver[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadQueueAndStaging = async () => {
      try {
        if (isMounted) {
          setIsLoading(true);
        }

        const [queuePayload, stagingPayload] = await Promise.all([
          fetchAirportQueue(airportCode, queueGroup),
          fetchAirportStagingDrivers(airportCode, queueGroup),
        ]);

        if (!isMounted) {
          return;
        }

        setQueueEntries(Array.isArray(queuePayload) ? queuePayload : []);
        setStagingDrivers(Array.isArray(stagingPayload) ? stagingPayload : []);
        setError("");
      } catch (requestError: unknown) {
        if (!isMounted) {
          return;
        }

        const message = requestError instanceof Error ? requestError.message : "Failed to load queue data.";
        setError(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadQueueAndStaging();
    const intervalId = window.setInterval(loadQueueAndStaging, 12000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [airportCode, queueGroup]);

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-700">Airport</span>
          <select
            value={airportCode}
            onChange={event => setAirportCode(event.target.value as AirportCode)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            {airportCodes.map(code => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-700">Queue Group</span>
          <select
            value={queueGroup}
            onChange={event => setQueueGroup(event.target.value as QueueGroup)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            {queueGroups.map(group => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      )}

      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold text-neutral-900">Queue</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-600">
                <th className="px-2 py-2">Pos</th>
                <th className="px-2 py-2">Driver</th>
                <th className="px-2 py-2">Car</th>
                <th className="px-2 py-2">Joined</th>
              </tr>
            </thead>
            <tbody>
              {queueEntries.map(entry => (
                <tr key={`${entry.driverId}-${entry.position}`} className="border-b border-neutral-100">
                  <td className="px-2 py-2 font-semibold">{entry.position}</td>
                  <td className="px-2 py-2">{entry.name}</td>
                  <td className="px-2 py-2">{entry.car}</td>
                  <td className="px-2 py-2">{formatTime(entry.joinedAt)}</td>
                </tr>
              ))}
              {!isLoading && queueEntries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-2 py-3 text-neutral-500">
                    No drivers in this queue.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold text-neutral-900">Staging Drivers</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {stagingDrivers.map(driver => (
            <article key={driver.driverId} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-sm font-semibold text-neutral-900">{driver.name}</p>
              <p className="text-xs text-neutral-600">{driver.email}</p>
              <p className="mt-2 text-xs text-neutral-700">Lot: {driver.lotCode || "-"}</p>
              <p className="text-xs text-neutral-700">Pickup zone: {driver.pickupZoneCode || "-"}</p>
              <p className="text-xs text-neutral-700">Joined: {formatTime(driver.joinedAt)}</p>
            </article>
          ))}
          {!isLoading && stagingDrivers.length === 0 && (
            <p className="text-sm text-neutral-500">No staging drivers found for this selection.</p>
          )}
        </div>
      </section>
    </div>
  );
}
