export type DemandBand = "normal" | "elevated" | "high";

export type AirportPeakWindow = {
  airportCode: string;
  airportName: string;
  title: string;
  localWindow: string;
};

export type NetworkOverview = {
  generatedAt: string;
  network: {
    activeRiders: number;
    approvedDrivers: number;
    pendingDrivers: number;
    activeTrips: number;
  };
  reliability: {
    completedTrips24h: number;
    completionRate24h: number;
  };
  demand: {
    requestBurstsLast30m: number;
    demandPressure: number;
    demandBand: DemandBand;
  };
  airportPeakWindows: AirportPeakWindow[];
  appBridge: {
    rider: {
      deepLink: string;
      fallbackPath: string;
    };
    driver: {
      deepLink: string;
      fallbackPath: string;
    };
  };
};

const PUBLIC_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const API_BASE =
  process.env.INTERNAL_API_BASE_URL ||
  (PUBLIC_API_BASE && /^https?:\/\//.test(PUBLIC_API_BASE) ? PUBLIC_API_BASE : undefined) ||
  "http://10.0.0.70:4000/api";

export async function fetchNetworkOverview(): Promise<NetworkOverview | null> {
  try {
    const response = await fetch(`${API_BASE}/public/network-overview`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as NetworkOverview;
    return payload;
  } catch {
    return null;
  }
}
