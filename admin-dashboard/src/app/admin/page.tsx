"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type AdminProfile = {
  email: string;
  role: string;
};

type Driver = {
  _id: string;
  name: string;
  phone: string;
  email: string;
  status: string;
  rejectionReason?: string | null;
  createdAt: string;
  docs?: Record<string, string | null | undefined>;
  vehicle?: {
    make?: string;
    model?: string;
    plateNumber?: string;
    color?: string;
    type?: string;
  } | null;
};

type TripPoint = {
  latitude: number;
  longitude: number;
  address?: string;
};

type MonitorTrip = {
  tripId: string;
  status: string;
  pickup?: TripPoint | null;
  dropoff?: TripPoint | null;
  currentDriverLocation?: TripPoint | null;
  routePointCount: number;
  rider?: { name?: string; phone?: string } | null;
  driver?: { name?: string; phone?: string } | null;
  surgeMultiplier?: number;
  fare?: number;
  updatedAt: string;
};

type MonitorTripPayload = {
  count: number;
  trips: MonitorTrip[];
};

type PricingConfig = {
  baseFare: number;
  perMileRate: number;
  perMinuteRate: number;
  averageSpeedMph: number;
  currency: string;
  platformCommissionRate: number;
};

type SurgeConfig = {
  demandRadiusKm: number;
  sensitivity: number;
  maxMultiplier: number;
};

type PricingFormState = {
  baseFare: string;
  perMileRate: string;
  perMinuteRate: string;
  averageSpeedMph: string;
  currency: string;
  platformCommissionRate: string;
};

type SurgeFormState = {
  demandRadiusKm: string;
  sensitivity: string;
  maxMultiplier: string;
};

type ComplianceReport = {
  window: {
    from: string;
    to: string;
  };
  trips: {
    totalTrips: number;
    completedTrips: number;
    cancelledTrips: number;
    activeTrips: number;
    completionRate: number;
    cancellationRate: number;
    completedWithoutReceipt: number;
  };
  operations: {
    activeDrivers: number;
    pendingDriverApprovals: number;
    rejectedDrivers: number;
    openComplaints?: number;
    resolvedComplaints?: number;
    openSafetyIncidents?: number;
    criticalSafetyIncidents?: number;
    expiringOrExpiredDriverDocuments?: number;
  };
  averages: {
    durationMinutes: number;
    distanceMiles: number;
    fare: number;
  };
  finance: {
    totalPlatformCommission: number;
  };
};

type ComplianceSummary = {
  window: {
    from: string;
    to: string;
  };
  complaints: {
    totalComplaints: number;
    openComplaints: number;
    resolvedComplaints: number;
  };
  incidents: {
    totalIncidents: number;
    openIncidents: number;
    criticalIncidents: number;
  };
  logs: {
    tripLogCount: number;
    driverLogCount: number;
  };
  documents: {
    upcomingOrExpiredWithin30Days: number;
  };
};

type IncidentReport = {
  _id: string;
  incidentType: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "investigating" | "resolved" | "dismissed";
  title: string;
  description: string;
  createdAt: string;
  resolvedAt?: string | null;
  trip?: { _id?: string; status?: string } | null;
  rider?: { name?: string } | null;
  driver?: { name?: string } | null;
};

type DocumentExpirationAlert = {
  driverId: string;
  driverName: string;
  driverEmail: string;
  driverPhone: string;
  driverStatus: string;
  docType: string;
  docStatus: string;
  expiresAt: string;
  isExpired: boolean;
  daysUntilExpiration: number;
  urgency: "medium" | "high" | "critical";
};

type DocumentAlertsPayload = {
  thresholdDays: number;
  count: number;
  alerts: DocumentExpirationAlert[];
};

type LoginResponse = {
  token: string;
  admin: AdminProfile;
};

type MapMarker = {
  key: string;
  x: number;
  y: number;
  tripId: string;
  kind: "pickup" | "dropoff" | "driver";
  label: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/backend-api";
const TOKEN_STORAGE_KEY = "rydinex_admin_token";

const defaultPricingFormState: PricingFormState = {
  baseFare: "2.5",
  perMileRate: "1.7",
  perMinuteRate: "0.35",
  averageSpeedMph: "20",
  currency: "USD",
  platformCommissionRate: "0.2",
};

const defaultSurgeFormState: SurgeFormState = {
  demandRadiusKm: "5",
  sensitivity: "0.7",
  maxMultiplier: "3",
};

function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleString();
}

function toTitleCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function shortId(value: string): string {
  if (!value) {
    return "—";
  }
  if (value.length <= 10) {
    return value;
  }
  return `${value.slice(0, 5)}...${value.slice(-4)}`;
}

function formatCurrency(amount: number, currencyCode: string): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const code = currencyCode || "USD";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeAmount);
  } catch {
    return `${safeAmount.toFixed(2)} ${code}`;
  }
}

function pricingToFormState(config: PricingConfig): PricingFormState {
  return {
    baseFare: String(config.baseFare),
    perMileRate: String(config.perMileRate),
    perMinuteRate: String(config.perMinuteRate),
    averageSpeedMph: String(config.averageSpeedMph),
    currency: config.currency,
    platformCommissionRate: String(config.platformCommissionRate),
  };
}

function surgeToFormState(config: SurgeConfig): SurgeFormState {
  return {
    demandRadiusKm: String(config.demandRadiusKm),
    sensitivity: String(config.sensitivity),
    maxMultiplier: String(config.maxMultiplier),
  };
}

function numberOrFallback(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePoint(point: TripPoint | null | undefined): TripPoint | null {
  if (!point) {
    return null;
  }

  const latitude = Number(point.latitude);
  const longitude = Number(point.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
    address: point.address,
  };
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const maybeMessage = (payload as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage;
    }
  }

  return fallback;
}

export default function Home() {
  const [token, setToken] = useState("");
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [monitorTrips, setMonitorTrips] = useState<MonitorTrip[]>([]);
  const [complianceReport, setComplianceReport] = useState<ComplianceReport | null>(null);
  const [complianceSummary, setComplianceSummary] = useState<ComplianceSummary | null>(null);
  const [incidentReports, setIncidentReports] = useState<IncidentReport[]>([]);
  const [documentAlerts, setDocumentAlerts] = useState<DocumentExpirationAlert[]>([]);
  const [pricingForm, setPricingForm] = useState<PricingFormState>(defaultPricingFormState);
  const [surgeForm, setSurgeForm] = useState<SurgeFormState>(defaultSurgeFormState);

  const [restoringSession, setRestoringSession] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);
  const [savingSurge, setSavingSurge] = useState(false);
  const [incidentUpdatingId, setIncidentUpdatingId] = useState("");
  const [exportingDataset, setExportingDataset] = useState("");
  const [driverActionId, setDriverActionId] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const apiRequest = useCallback(
    async <T,>(path: string, options: RequestInit = {}, authToken: string | null = null): Promise<T> => {
      const headers = new Headers(options.headers || undefined);

      if (options.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      if (authToken) {
        headers.set("Authorization", `Bearer ${authToken}`);
      }

      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        cache: "no-store",
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, `Request failed with status ${response.status}.`));
      }

      return payload as T;
    },
    []
  );

  const loadDashboardData = useCallback(
    async (authToken: string) => {
      try {
        setLoading(true);
        setError("");

        const [driverPayload, monitorPayload, reportPayload, pricingPayload, surgePayload, summaryPayload, incidentsPayload, alertsPayload] =
          await Promise.all([
          apiRequest<Driver[]>("/admin/drivers?status=pending", {}, authToken),
          apiRequest<MonitorTripPayload>("/admin/trips/monitor", {}, authToken),
          apiRequest<ComplianceReport>("/admin/reports/compliance", {}, authToken),
          apiRequest<PricingConfig>("/admin/pricing", {}, authToken),
          apiRequest<SurgeConfig>("/admin/surge", {}, authToken),
          apiRequest<ComplianceSummary>("/admin/compliance/reports/compliance/summary", {}, authToken),
          apiRequest<IncidentReport[]>("/admin/compliance/incidents?limit=50", {}, authToken),
          apiRequest<DocumentAlertsPayload>("/admin/compliance/documents/expirations?thresholdDays=30", {}, authToken),
          ]);

        setDrivers(Array.isArray(driverPayload) ? driverPayload : []);
        setMonitorTrips(Array.isArray(monitorPayload.trips) ? monitorPayload.trips : []);
        setComplianceReport(reportPayload);
        setPricingForm(pricingToFormState(pricingPayload));
        setSurgeForm(surgeToFormState(surgePayload));
        setComplianceSummary(summaryPayload || null);
        setIncidentReports(Array.isArray(incidentsPayload) ? incidentsPayload : []);
        setDocumentAlerts(Array.isArray(alertsPayload?.alerts) ? alertsPayload.alerts : []);
      } catch (requestError: unknown) {
        const message = requestError instanceof Error ? requestError.message : "Failed to load admin dashboard data.";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [apiRequest]
  );

  const clearSession = useCallback(() => {
    setToken("");
    setAdmin(null);
    setDrivers([]);
    setMonitorTrips([]);
    setComplianceReport(null);
    setComplianceSummary(null);
    setIncidentReports([]);
    setDocumentAlerts([]);
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }, []);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    let disposed = false;

    const verifySession = async () => {
      try {
        setRestoringSession(true);
        const profile = await apiRequest<AdminProfile>("/admin/auth/me", {}, token);
        if (disposed) {
          return;
        }
        setAdmin(profile);
      } catch (sessionError: unknown) {
        if (disposed) {
          return;
        }
        clearSession();
        const message = sessionError instanceof Error ? sessionError.message : "Admin session expired.";
        setError(message);
      } finally {
        if (!disposed) {
          setRestoringSession(false);
        }
      }
    };

    verifySession();

    return () => {
      disposed = true;
    };
  }, [apiRequest, clearSession, token]);

  useEffect(() => {
    if (!token || !admin) {
      return;
    }

    loadDashboardData(token);
  }, [admin, loadDashboardData, token]);

  const mapMarkers = useMemo<MapMarker[]>(() => {
    const markerEntries: Array<{
      tripId: string;
      kind: MapMarker["kind"];
      point: TripPoint;
      label: string;
    }> = [];

    monitorTrips.forEach(trip => {
      const pickup = normalizePoint(trip.pickup || null);
      const dropoff = normalizePoint(trip.dropoff || null);
      const driverLocation = normalizePoint(trip.currentDriverLocation || null);

      if (pickup) {
        markerEntries.push({
          tripId: trip.tripId,
          kind: "pickup",
          point: pickup,
          label: `Trip ${shortId(trip.tripId)} pickup`,
        });
      }

      if (dropoff) {
        markerEntries.push({
          tripId: trip.tripId,
          kind: "dropoff",
          point: dropoff,
          label: `Trip ${shortId(trip.tripId)} dropoff`,
        });
      }

      if (driverLocation) {
        markerEntries.push({
          tripId: trip.tripId,
          kind: "driver",
          point: driverLocation,
          label: `Trip ${shortId(trip.tripId)} driver location`,
        });
      }
    });

    if (markerEntries.length === 0) {
      return [];
    }

    const latitudes = markerEntries.map(entry => entry.point.latitude);
    const longitudes = markerEntries.map(entry => entry.point.longitude);
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);

    const latitudeSpan = Math.max(maxLatitude - minLatitude, 0.02);
    const longitudeSpan = Math.max(maxLongitude - minLongitude, 0.02);

    return markerEntries.map((entry, index) => {
      const x = ((entry.point.longitude - minLongitude) / longitudeSpan) * 100;
      const y = (1 - (entry.point.latitude - minLatitude) / latitudeSpan) * 100;

      return {
        key: `${entry.tripId}-${entry.kind}-${index}`,
        x,
        y,
        tripId: entry.tripId,
        kind: entry.kind,
        label: entry.label,
      };
    });
  }, [monitorTrips]);

  const currentCurrency = pricingForm.currency.trim().toUpperCase() || "USD";

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setAuthLoading(true);
      setError("");
      setSuccess("");

      const payload = await apiRequest<LoginResponse>(
        "/admin/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        },
        null
      );

      setToken(payload.token);
      setAdmin(payload.admin);
      window.localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
      setSuccess("Admin authenticated successfully.");
    } catch (authError: unknown) {
      const message = authError instanceof Error ? authError.message : "Failed to authenticate admin.";
      setError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    setSuccess("");
    setError("");
  };

  const handleRefresh = async () => {
    if (!token) {
      return;
    }
    await loadDashboardData(token);
  };

  const handleDriverReview = async (driverId: string, action: "approve" | "reject") => {
    if (!token) {
      return;
    }

    let rejectionReason = "";
    if (action === "reject") {
      const promptResult = window.prompt("Provide a rejection reason", "Document verification failed.");
      if (promptResult === null) {
        return;
      }
      rejectionReason = promptResult;
    }

    try {
      setDriverActionId(driverId);
      setError("");
      setSuccess("");

      await apiRequest<{ message: string }>(
        `/admin/drivers/${driverId}/review`,
        {
          method: "PATCH",
          body: JSON.stringify({
            action,
            rejectionReason,
          }),
        },
        token
      );

      setSuccess(`Driver ${action}d successfully.`);
      await loadDashboardData(token);
    } catch (reviewError: unknown) {
      const message = reviewError instanceof Error ? reviewError.message : "Failed to review driver.";
      setError(message);
    } finally {
      setDriverActionId("");
    }
  };

  const handlePricingFieldChange = (field: keyof PricingFormState, value: string) => {
    setPricingForm(previous => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSurgeFieldChange = (field: keyof SurgeFormState, value: string) => {
    setSurgeForm(previous => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSavePricing = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      return;
    }

    const payload = {
      baseFare: numberOrFallback(pricingForm.baseFare, 2.5),
      perMileRate: numberOrFallback(pricingForm.perMileRate, 1.7),
      perMinuteRate: numberOrFallback(pricingForm.perMinuteRate, 0.35),
      averageSpeedMph: numberOrFallback(pricingForm.averageSpeedMph, 20),
      currency: pricingForm.currency.trim().toUpperCase() || "USD",
      platformCommissionRate: numberOrFallback(pricingForm.platformCommissionRate, 0.2),
    };

    try {
      setSavingPricing(true);
      setError("");
      setSuccess("");

      const response = await apiRequest<{ pricing: PricingConfig; message: string }>(
        "/admin/pricing",
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
        token
      );

      setPricingForm(pricingToFormState(response.pricing));
      setSuccess(response.message || "Pricing configuration updated.");
    } catch (pricingError: unknown) {
      const message = pricingError instanceof Error ? pricingError.message : "Failed to update pricing configuration.";
      setError(message);
    } finally {
      setSavingPricing(false);
    }
  };

  const handleSaveSurge = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      return;
    }

    const payload = {
      demandRadiusKm: numberOrFallback(surgeForm.demandRadiusKm, 5),
      sensitivity: numberOrFallback(surgeForm.sensitivity, 0.7),
      maxMultiplier: numberOrFallback(surgeForm.maxMultiplier, 3),
    };

    try {
      setSavingSurge(true);
      setError("");
      setSuccess("");

      const response = await apiRequest<{ surge: SurgeConfig; message: string }>(
        "/admin/surge",
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
        token
      );

      setSurgeForm(surgeToFormState(response.surge));
      setSuccess(response.message || "Surge configuration updated.");
    } catch (surgeError: unknown) {
      const message = surgeError instanceof Error ? surgeError.message : "Failed to update surge configuration.";
      setError(message);
    } finally {
      setSavingSurge(false);
    }
  };

  const handleIncidentStatusUpdate = async (incidentId: string, status: IncidentReport["status"]) => {
    if (!token) {
      return;
    }

    try {
      setIncidentUpdatingId(incidentId);
      setError("");
      setSuccess("");

      await apiRequest<{ message: string }>(
        `/admin/compliance/incidents/${incidentId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status,
            resolutionNotes: status === "resolved" ? "Resolved by admin dashboard." : "Status updated by admin dashboard.",
          }),
        },
        token
      );

      setSuccess("Incident report updated successfully.");
      await loadDashboardData(token);
    } catch (incidentError: unknown) {
      const message = incidentError instanceof Error ? incidentError.message : "Failed to update incident report.";
      setError(message);
    } finally {
      setIncidentUpdatingId("");
    }
  };

  const handleExport = async (dataset: string, format: "json" | "csv") => {
    if (!token) {
      return;
    }

    try {
      setExportingDataset(`${dataset}:${format}`);
      setError("");

      const response = await fetch(`${API_BASE}/admin/compliance/export?dataset=${encodeURIComponent(dataset)}&format=${format}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(getErrorMessage(payload, `Failed export request (${response.status}).`));
      }

      if (format === "csv") {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${dataset}_${Date.now()}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
      } else {
        const payload = await response.json();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${dataset}_${Date.now()}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
      }

      setSuccess(`Export completed for ${dataset} (${format.toUpperCase()}).`);
    } catch (exportError: unknown) {
      const message = exportError instanceof Error ? exportError.message : "Failed to export compliance data.";
      setError(message);
    } finally {
      setExportingDataset("");
    }
  };

  if (!token || !admin) {
    return (
      <main className="min-h-screen bg-[#131314] p-6 md:p-10 text-[#e5e2e3]">
        <div className="mx-auto max-w-md rounded-xl border border-[#424654] bg-[#1f1f20] p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Rydinex Admin Login</h1>
          <p className="mt-2 text-sm text-[#c2c6d7]">
            Authenticate to access driver approvals, trip monitoring, surge controls, pricing controls, and compliance reports.
          </p>

          {error ? <p className="mt-4 rounded-md bg-[#492525] px-3 py-2 text-sm text-[#ffb4ab]">{error}</p> : null}

          {restoringSession ? (
            <p className="mt-4 text-sm text-[#c2c6d7]">Restoring your admin session...</p>
          ) : (
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#c2c6d7]" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  className="w-full rounded-md border border-[#424654] bg-[#2a2a2b] px-3 py-2 text-sm text-[#e5e2e3]"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#c2c6d7]" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  className="w-full rounded-md border border-[#424654] bg-[#2a2a2b] px-3 py-2 text-sm text-[#e5e2e3]"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full rounded-md bg-[#276ef1] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authLoading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#131314] p-6 md:p-8 text-[#e5e2e3]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Rydinex Admin Dashboard</h1>
            <p className="text-sm text-[#c2c6d7]">Driver approvals, trip monitoring map, surge and pricing controls, compliance reporting.</p>
          </div>

          <div className="flex items-center gap-2">
            <p className="hidden text-sm text-[#c2c6d7] md:block">{admin.email}</p>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="rounded-md border border-[#424654] bg-[#1f1f20] px-3 py-2 text-sm font-medium"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button onClick={handleLogout} className="rounded-md bg-[#276ef1] px-3 py-2 text-sm font-medium text-white">
              Logout
            </button>
          </div>
        </header>

        {error ? <p className="rounded-md bg-[#492525] px-4 py-3 text-sm text-[#ffb4ab]">{error}</p> : null}
        {success ? <p className="rounded-md bg-[#163828] px-4 py-3 text-sm text-[#97f0ba]">{success}</p> : null}

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-lg border border-[#424654] bg-[#1f1f20] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Driver Approval Panel</h2>
              <span className="rounded bg-[#2a2a2b] px-2 py-1 text-xs font-medium text-[#c2c6d7]">Pending: {drivers.length}</span>
            </div>

            <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
              {drivers.length === 0 ? (
                <p className="rounded border border-dashed border-[#424654] p-4 text-sm text-[#aab0c2]">No pending drivers found.</p>
              ) : (
                drivers.map(driver => {
                  const vehicleSummary =
                    driver.vehicle && (driver.vehicle.make || driver.vehicle.model)
                      ? `${driver.vehicle.make || ""} ${driver.vehicle.model || ""}`.trim()
                      : "Vehicle pending";

                  const docsSubmitted = Object.values(driver.docs || {}).filter(Boolean).length;

                  return (
                    <div key={driver._id} className="rounded-md border border-[#424654] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-[#e5e2e3]">{driver.name || "Unknown driver"}</p>
                          <p className="text-xs text-[#c2c6d7]">{driver.email || "No email"}</p>
                          <p className="text-xs text-[#c2c6d7]">{driver.phone || "No phone"}</p>
                        </div>
                        <span className="rounded bg-[#3d2f1b] px-2 py-1 text-xs font-medium text-[#ffcf8f]">{toTitleCase(driver.status || "pending")}</span>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#c2c6d7]">
                        <p>Vehicle: {vehicleSummary}</p>
                        <p>Plate: {driver.vehicle?.plateNumber || "N/A"}</p>
                        <p>Docs submitted: {docsSubmitted}</p>
                        <p>Created: {formatDateTime(driver.createdAt)}</p>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleDriverReview(driver._id, "approve")}
                          disabled={driverActionId === driver._id}
                          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDriverReview(driver._id, "reject")}
                          disabled={driverActionId === driver._id}
                          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </article>

          <article className="rounded-lg border border-[#424654] bg-[#1f1f20] p-5">
            <h2 className="text-lg font-semibold">Trip Monitoring Map</h2>
            <p className="mt-1 text-sm text-[#c2c6d7]">Active trips with pickup, dropoff, and live driver positions.</p>

            <div className="mt-4">
              <div className="relative h-72 overflow-hidden rounded-md border border-[#424654] bg-[#131314]">
                {mapMarkers.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-[#aab0c2]">No active trip coordinates available.</div>
                ) : (
                  <>
                    {mapMarkers.map(marker => {
                      const markerStyle =
                        marker.kind === "pickup"
                          ? "bg-blue-600"
                          : marker.kind === "dropoff"
                          ? "bg-emerald-600"
                          : "bg-red-600";

                      return (
                        <div
                          key={marker.key}
                          title={marker.label}
                          className={`absolute h-3.5 w-3.5 rounded-full border-2 border-white shadow ${markerStyle}`}
                          style={{
                            left: `${marker.x}%`,
                            top: `${marker.y}%`,
                            transform: "translate(-50%, -50%)",
                          }}
                        />
                      );
                    })}
                  </>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#c2c6d7]">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded-full bg-blue-600" /> Pickup
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded-full bg-emerald-600" /> Dropoff
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded-full bg-red-600" /> Driver
                </span>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-md border border-[#424654]">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-[#131314]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Trip</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Rider</th>
                    <th className="px-3 py-2 font-semibold">Driver</th>
                    <th className="px-3 py-2 font-semibold">Fare</th>
                    <th className="px-3 py-2 font-semibold">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {monitorTrips.map(trip => (
                    <tr key={trip.tripId} className="border-t border-[#424654]">
                      <td className="px-3 py-2">{shortId(trip.tripId)}</td>
                      <td className="px-3 py-2">{toTitleCase(trip.status || "unknown")}</td>
                      <td className="px-3 py-2">{trip.rider?.name || "N/A"}</td>
                      <td className="px-3 py-2">{trip.driver?.name || "N/A"}</td>
                      <td className="px-3 py-2">
                        {formatCurrency(Number(trip.fare || 0), currentCurrency)} ({Number(trip.surgeMultiplier || 1).toFixed(2)}x)
                      </td>
                      <td className="px-3 py-2">{formatDateTime(trip.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {monitorTrips.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-[#aab0c2]">No active trips to monitor.</p>
              ) : null}
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-lg border border-[#424654] bg-[#1f1f20] p-5">
            <h2 className="text-lg font-semibold">Pricing Control Panel</h2>
            <form onSubmit={handleSavePricing} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-[#c2c6d7]">
                Base Fare
                <input
                  type="number"
                  step="0.01"
                  value={pricingForm.baseFare}
                  onChange={event => handlePricingFieldChange("baseFare", event.target.value)}
                  className="mt-1 w-full rounded-md border border-[#424654] bg-[#2a2a2b] px-3 py-2 text-sm text-[#e5e2e3]"
                />
              </label>

              <label className="text-sm text-[#c2c6d7]">
                Per Mile Rate
                <input
                  type="number"
                  step="0.01"
                  value={pricingForm.perMileRate}
                  onChange={event => handlePricingFieldChange("perMileRate", event.target.value)}
                  className="mt-1 w-full rounded-md border border-[#424654] bg-[#2a2a2b] px-3 py-2 text-sm text-[#e5e2e3]"
                />
              </label>

              <label className="text-sm text-[#c2c6d7]">
                Per Minute Rate
                <input
                  type="number"
                  step="0.01"
                  value={pricingForm.perMinuteRate}
                  onChange={event => handlePricingFieldChange("perMinuteRate", event.target.value)}
                  className="mt-1 w-full rounded-md border border-[#424654] bg-[#2a2a2b] px-3 py-2 text-sm text-[#e5e2e3]"
                />
              </label>

              <label className="text-sm text-[#c2c6d7]">
                Average Speed (MPH)
                <input
                  type="number"
                  step="0.1"
                  value={pricingForm.averageSpeedMph}
                  onChange={event => handlePricingFieldChange("averageSpeedMph", event.target.value)}
                  className="mt-1 w-full rounded-md border border-[#424654] bg-[#2a2a2b] px-3 py-2 text-sm text-[#e5e2e3]"
                />
              </label>

              <label className="text-sm text-[#c2c6d7]">
                Currency
                <input
                  type="text"
                  value={pricingForm.currency}
                  onChange={event => handlePricingFieldChange("currency", event.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-md border border-[#424654] bg-[#2a2a2b] px-3 py-2 text-sm text-[#e5e2e3]"
                />
              </label>

              <label className="text-sm text-[#c2c6d7]">
                Platform Commission Rate
                <input
                  type="number"
                  step="0.01"
                  value={pricingForm.platformCommissionRate}
                  onChange={event => handlePricingFieldChange("platformCommissionRate", event.target.value)}
                  className="mt-1 w-full rounded-md border border-[#424654] bg-[#2a2a2b] px-3 py-2 text-sm text-[#e5e2e3]"
                />
              </label>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={savingPricing}
                  className="rounded-md bg-[#276ef1] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingPricing ? "Saving..." : "Save Pricing"}
                </button>
              </div>
            </form>
          </article>

          <article className="rounded-lg border border-[#424654] bg-[#1f1f20] p-5">
            <h2 className="text-lg font-semibold">Surge Control Panel</h2>
            <form onSubmit={handleSaveSurge} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-[#c2c6d7]">
                Demand Radius (KM)
                <input
                  type="number"
                  step="0.1"
                  value={surgeForm.demandRadiusKm}
                  onChange={event => handleSurgeFieldChange("demandRadiusKm", event.target.value)}
                  className="mt-1 w-full rounded-md border border-[#424654] bg-[#2a2a2b] px-3 py-2 text-sm text-[#e5e2e3]"
                />
              </label>

              <label className="text-sm text-[#c2c6d7]">
                Sensitivity
                <input
                  type="number"
                  step="0.01"
                  value={surgeForm.sensitivity}
                  onChange={event => handleSurgeFieldChange("sensitivity", event.target.value)}
                  className="mt-1 w-full rounded-md border border-[#424654] bg-[#2a2a2b] px-3 py-2 text-sm text-[#e5e2e3]"
                />
              </label>

              <label className="text-sm text-[#c2c6d7]">
                Max Multiplier
                <input
                  type="number"
                  step="0.1"
                  value={surgeForm.maxMultiplier}
                  onChange={event => handleSurgeFieldChange("maxMultiplier", event.target.value)}
                  className="mt-1 w-full rounded-md border border-[#424654] bg-[#2a2a2b] px-3 py-2 text-sm text-[#e5e2e3]"
                />
              </label>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={savingSurge}
                  className="rounded-md bg-[#276ef1] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingSurge ? "Saving..." : "Save Surge"}
                </button>
              </div>
            </form>
          </article>
        </section>

        <section className="rounded-lg border border-[#424654] bg-[#1f1f20] p-5">
          <h2 className="text-lg font-semibold">Compliance Reports</h2>
          {complianceReport ? (
            <>
              <p className="mt-1 text-sm text-[#c2c6d7]">
                Window: {formatDateTime(complianceReport.window.from)} to {formatDateTime(complianceReport.window.to)}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-md border border-[#424654] bg-[#131314] p-3">
                  <p className="text-xs text-[#c2c6d7]">Total Trips</p>
                  <p className="mt-1 text-lg font-semibold">{complianceReport.trips.totalTrips}</p>
                </div>
                <div className="rounded-md border border-[#424654] bg-[#131314] p-3">
                  <p className="text-xs text-[#c2c6d7]">Completion Rate</p>
                  <p className="mt-1 text-lg font-semibold">{complianceReport.trips.completionRate.toFixed(2)}%</p>
                </div>
                <div className="rounded-md border border-[#424654] bg-[#131314] p-3">
                  <p className="text-xs text-[#c2c6d7]">Cancellation Rate</p>
                  <p className="mt-1 text-lg font-semibold">{complianceReport.trips.cancellationRate.toFixed(2)}%</p>
                </div>
                <div className="rounded-md border border-[#424654] bg-[#131314] p-3">
                  <p className="text-xs text-[#c2c6d7]">Pending Driver Approvals</p>
                  <p className="mt-1 text-lg font-semibold">{complianceReport.operations.pendingDriverApprovals}</p>
                </div>
                <div className="rounded-md border border-[#424654] bg-[#131314] p-3">
                  <p className="text-xs text-[#c2c6d7]">Active Drivers</p>
                  <p className="mt-1 text-lg font-semibold">{complianceReport.operations.activeDrivers}</p>
                </div>
                <div className="rounded-md border border-[#424654] bg-[#131314] p-3">
                  <p className="text-xs text-[#c2c6d7]">Open Complaints</p>
                  <p className="mt-1 text-lg font-semibold">{complianceReport.operations.openComplaints || 0}</p>
                </div>
                <div className="rounded-md border border-[#424654] bg-[#131314] p-3">
                  <p className="text-xs text-[#c2c6d7]">Open Safety Incidents</p>
                  <p className="mt-1 text-lg font-semibold">{complianceReport.operations.openSafetyIncidents || 0}</p>
                </div>
                <div className="rounded-md border border-[#424654] bg-[#131314] p-3">
                  <p className="text-xs text-[#c2c6d7]">Critical Incidents</p>
                  <p className="mt-1 text-lg font-semibold">{complianceReport.operations.criticalSafetyIncidents || 0}</p>
                </div>
                <div className="rounded-md border border-[#424654] bg-[#131314] p-3">
                  <p className="text-xs text-[#c2c6d7]">Docs Expiring/Expired (30d)</p>
                  <p className="mt-1 text-lg font-semibold">{complianceReport.operations.expiringOrExpiredDriverDocuments || 0}</p>
                </div>
                <div className="rounded-md border border-[#424654] bg-[#131314] p-3">
                  <p className="text-xs text-[#c2c6d7]">Platform Commission</p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatCurrency(complianceReport.finance.totalPlatformCommission, currentCurrency)}
                  </p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-md border border-[#424654]">
                <table className="min-w-full text-left text-sm">
                  <tbody>
                    <tr className="border-b border-[#424654]">
                      <th className="px-3 py-2 font-medium text-[#c2c6d7]">Completed Trips</th>
                      <td className="px-3 py-2">{complianceReport.trips.completedTrips}</td>
                      <th className="px-3 py-2 font-medium text-[#c2c6d7]">Cancelled Trips</th>
                      <td className="px-3 py-2">{complianceReport.trips.cancelledTrips}</td>
                    </tr>
                    <tr className="border-b border-[#424654]">
                      <th className="px-3 py-2 font-medium text-[#c2c6d7]">Active Trips</th>
                      <td className="px-3 py-2">{complianceReport.trips.activeTrips}</td>
                      <th className="px-3 py-2 font-medium text-[#c2c6d7]">Completed Without Receipt</th>
                      <td className="px-3 py-2">{complianceReport.trips.completedWithoutReceipt}</td>
                    </tr>
                    <tr>
                      <th className="px-3 py-2 font-medium text-[#c2c6d7]">Avg Duration</th>
                      <td className="px-3 py-2">{complianceReport.averages.durationMinutes.toFixed(2)} min</td>
                      <th className="px-3 py-2 font-medium text-[#c2c6d7]">Avg Distance / Fare</th>
                      <td className="px-3 py-2">
                        {complianceReport.averages.distanceMiles.toFixed(2)} mi / {formatCurrency(complianceReport.averages.fare, currentCurrency)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-[#aab0c2]">No compliance report data available.</p>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-lg border border-[#424654] bg-[#1f1f20] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Incident Reports</h2>
              <span className="rounded bg-[#2a2a2b] px-2 py-1 text-xs font-medium text-[#c2c6d7]">{incidentReports.length} recent</span>
            </div>

            <div className="max-h-[360px] space-y-3 overflow-auto pr-1">
              {incidentReports.length === 0 ? (
                <p className="rounded border border-dashed border-[#424654] p-4 text-sm text-[#aab0c2]">No incident reports found.</p>
              ) : (
                incidentReports.map(incident => (
                  <div key={incident._id} className="rounded-md border border-[#424654] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-[#e5e2e3]">{incident.title}</p>
                      <span className="rounded bg-[#2a2a2b] px-2 py-1 text-xs text-[#c2c6d7]">{toTitleCase(incident.status)}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#c2c6d7]">{incident.description}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#c2c6d7]">
                      <p>Type: {toTitleCase(incident.incidentType)}</p>
                      <p>Severity: {toTitleCase(incident.severity)}</p>
                      <p>Driver: {incident.driver?.name || "N/A"}</p>
                      <p>Rider: {incident.rider?.name || "N/A"}</p>
                      <p>Trip: {incident.trip?._id ? shortId(incident.trip._id) : "N/A"}</p>
                      <p>Created: {formatDateTime(incident.createdAt)}</p>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleIncidentStatusUpdate(incident._id, "investigating")}
                        disabled={incidentUpdatingId === incident._id || incident.status === "investigating"}
                        className="rounded-md border border-[#424654] bg-[#1f1f20] px-2 py-1 text-xs"
                      >
                        Investigating
                      </button>
                      <button
                        onClick={() => handleIncidentStatusUpdate(incident._id, "resolved")}
                        disabled={incidentUpdatingId === incident._id || incident.status === "resolved"}
                        className="rounded-md bg-green-600 px-2 py-1 text-xs text-white"
                      >
                        Resolve
                      </button>
                      <button
                        onClick={() => handleIncidentStatusUpdate(incident._id, "dismissed")}
                        disabled={incidentUpdatingId === incident._id || incident.status === "dismissed"}
                        className="rounded-md bg-[#353436] px-2 py-1 text-xs text-white"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-lg border border-[#424654] bg-[#1f1f20] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Document Expiration Alerts</h2>
              <span className="rounded bg-[#2a2a2b] px-2 py-1 text-xs font-medium text-[#c2c6d7]">{documentAlerts.length} alerts</span>
            </div>

            <div className="max-h-[360px] space-y-3 overflow-auto pr-1">
              {documentAlerts.length === 0 ? (
                <p className="rounded border border-dashed border-[#424654] p-4 text-sm text-[#aab0c2]">No upcoming document expiration alerts.</p>
              ) : (
                documentAlerts.map((alert, index) => (
                  <div key={`${alert.driverId}-${alert.docType}-${index}`} className="rounded-md border border-[#424654] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-[#e5e2e3]">{alert.driverName} · {alert.docType}</p>
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          alert.urgency === "critical"
                            ? "bg-[#492525] text-[#ffb4ab]"
                            : alert.urgency === "high"
                            ? "bg-[#3d2f1b] text-[#ffcf8f]"
                            : "bg-[#31477c] text-[#dbe5ff]"
                        }`}
                      >
                        {toTitleCase(alert.urgency)}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#c2c6d7]">
                      <p>Status: {toTitleCase(alert.driverStatus)}</p>
                      <p>Doc Status: {toTitleCase(alert.docStatus)}</p>
                      <p>Expires: {formatDateTime(alert.expiresAt)}</p>
                      <p>{alert.isExpired ? "Expired" : `${alert.daysUntilExpiration} days left`}</p>
                    </div>
                    <p className="mt-2 text-xs text-[#c2c6d7]">{alert.driverEmail} · {alert.driverPhone}</p>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>

        <section className="rounded-lg border border-[#424654] bg-[#1f1f20] p-5">
          <h2 className="text-lg font-semibold">Data Export</h2>
          <p className="mt-1 text-sm text-[#c2c6d7]">Download compliance datasets as JSON or CSV.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { key: "complaints", label: "Complaints" },
              { key: "safety_logs", label: "Safety Logs" },
              { key: "trip_logs", label: "Trip Logs" },
              { key: "driver_logs", label: "Driver Logs" },
              { key: "document_alerts", label: "Document Alerts" },
            ].map(dataset => (
              <div key={dataset.key} className="rounded-md border border-[#424654] p-3">
                <p className="text-sm font-medium text-[#e5e2e3]">{dataset.label}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => handleExport(dataset.key, "json")}
                    disabled={Boolean(exportingDataset)}
                    className="rounded-md border border-[#424654] bg-[#1f1f20] px-2 py-1 text-xs"
                  >
                    {exportingDataset === `${dataset.key}:json` ? "Exporting..." : "JSON"}
                  </button>
                  <button
                    onClick={() => handleExport(dataset.key, "csv")}
                    disabled={Boolean(exportingDataset)}
                    className="rounded-md bg-[#276ef1] px-2 py-1 text-xs text-white"
                  >
                    {exportingDataset === `${dataset.key}:csv` ? "Exporting..." : "CSV"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {complianceSummary ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <p className="rounded bg-[#131314] px-3 py-2">Complaints: {complianceSummary.complaints.totalComplaints}</p>
              <p className="rounded bg-[#131314] px-3 py-2">Open Incidents: {complianceSummary.incidents.openIncidents}</p>
              <p className="rounded bg-[#131314] px-3 py-2">Trip Logs: {complianceSummary.logs.tripLogCount}</p>
              <p className="rounded bg-[#131314] px-3 py-2">Driver Logs: {complianceSummary.logs.driverLogCount}</p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}



