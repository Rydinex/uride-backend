export type AirportCode = "ORD" | "MDW";
export type QueueGroup = "standard" | "black";

export type AirportSummaryMetrics = {
  standardQueue: number;
  blackQueue: number;
  driversInStaging: number;
  activeTrips: number;
};

export type AirportSummaryResponse = Record<AirportCode, AirportSummaryMetrics>;

export type AirportQueueEntry = {
  driverId: string | null;
  name: string;
  car: string;
  position: number;
  joinedAt: string;
};

export type AirportStagingDriver = {
  driverId: string;
  name: string;
  phone: string;
  email: string;
  queueGroup: QueueGroup;
  joinedAt: string;
  lotCode: string | null;
  pickupZoneCode: string | null;
  vehicle: {
    make: string | null;
    model: string | null;
    plateNumber: string | null;
    color: string | null;
  } | null;
};

export type AirportViolation = {
  id: string;
  driverId: string | null;
  driverName: string | null;
  incidentType: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  description: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/backend-api";
const TOKEN_STORAGE_KEY = "rydinex_admin_token";

function getAdminToken(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY) || "";
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
}

async function adminRequest<T>(path: string): Promise<T> {
  const token = getAdminToken();
  if (!token) {
    throw new Error("Admin session not found. Please log in on the Admin page first.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, `Request failed with status ${response.status}.`));
  }

  return payload as T;
}

export function fetchAirportSummary() {
  return adminRequest<AirportSummaryResponse>("/admin/airport/summary");
}

export function fetchAirportQueue(airportCode: AirportCode, queueGroup: QueueGroup) {
  return adminRequest<AirportQueueEntry[]>(`/admin/airport/${airportCode}/queue/${queueGroup}`);
}

export function fetchAirportStagingDrivers(airportCode: AirportCode, queueGroup: QueueGroup) {
  return adminRequest<AirportStagingDriver[]>(`/admin/airport/${airportCode}/staging/${queueGroup}`);
}

export function fetchAirportViolations() {
  return adminRequest<AirportViolation[]>("/admin/airport/violations");
}
