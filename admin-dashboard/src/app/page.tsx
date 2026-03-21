import Link from "next/link";
import { fetchNetworkOverview } from "./lib/networkOverview";
import styles from "./page.module.css";

const connectionPillars = [
  {
    title: "Rider app intelligence",
    detail:
      "Trip requests, destination intent, and safety preferences are normalized before dispatch so matching stays consistent.",
  },
  {
    title: "Driver app heartbeat",
    detail:
      "Online/offline state, queue position, and route telemetry sync every few seconds to keep dispatch decisions current.",
  },
  {
    title: "Ops control plane",
    detail:
      "Compliance, incident workflows, surge parameters, and payout signals are all visible in one timeline for operators.",
  },
];

const roadmap = [
  {
    step: "01",
    title: "Request",
    detail: "Rider app captures pickup, dropoff, and preferences with transparent fare context.",
  },
  {
    step: "02",
    title: "Match",
    detail: "Dispatch ranks available drivers using proximity, route quality, and realtime demand pressure.",
  },
  {
    step: "03",
    title: "Move",
    detail: "Driver and rider apps stay synchronized through trip tracking, safety events, and payout state.",
  },
];

function formatPercent(value: number | null | undefined): string {
  if (!Number.isFinite(Number(value))) {
    return "N/A";
  }

  return `${Number(value).toFixed(2)}%`;
}

function formatDemandBand(value: string | null | undefined): string {
  if (!value) {
    return "Normal";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatGeneratedAt(value: string | null | undefined): string {
  if (!value) {
    return "Realtime sync unavailable";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Realtime sync unavailable";
  }

  return `Live data synced ${parsed.toLocaleString()}`;
}

export default async function HomePage() {
  const overview = await fetchNetworkOverview();

  const riderDeepLink = overview?.appBridge?.rider?.deepLink || "rydinex://open";
  const driverDeepLink = overview?.appBridge?.driver?.deepLink || "rydinex-driver://open";
  const riderFallbackPath = overview?.appBridge?.rider?.fallbackPath || "/rider-app";
  const driverFallbackPath = overview?.appBridge?.driver?.fallbackPath || "/driver-app";

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <header className={styles.topBar}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>RX</span>
            <div>
              <p className={styles.brandName}>rydinex.com</p>
              <p className={styles.brandSub}>Connected City Mobility</p>
            </div>
          </div>

          <nav className={styles.nav}>
            <a href="#connectivity">Connectivity</a>
            <a href="#airports">Airport Windows</a>
            <a href="#apps">Apps</a>
            <Link href="/connect">Connect Center</Link>
            <Link href="/admin">Ops Console</Link>
          </nav>
        </header>

        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Rydinex Cloud Platform</p>
            <h1>Rider and driver apps, fully synced in one realtime network.</h1>
            <p>
              Rydinex is built to deliver faster matching, clearer earnings visibility, and safer operations by keeping
              every app and dashboard on the same live backbone.
            </p>

            <div className={styles.ctaRow}>
              <Link className={styles.primaryCta} href="/connect">
                Open App Connectivity Center
              </Link>
              <Link className={styles.secondaryCta} href="/admin">
                Launch Operations Console
              </Link>
            </div>

            <p className={styles.liveText}>{formatGeneratedAt(overview?.generatedAt)}</p>
          </div>

          <aside className={styles.livePanel}>
            <p className={styles.liveEyebrow}>Network Snapshot</p>
            <div className={styles.metricGrid}>
              <article>
                <p>{overview?.network?.activeRiders ?? 0}</p>
                <span>Active riders</span>
              </article>
              <article>
                <p>{overview?.network?.approvedDrivers ?? 0}</p>
                <span>Approved drivers</span>
              </article>
              <article>
                <p>{overview?.network?.activeTrips ?? 0}</p>
                <span>Active trips</span>
              </article>
              <article>
                <p>{formatPercent(overview?.reliability?.completionRate24h)}</p>
                <span>Completion rate (24h)</span>
              </article>
            </div>
            <p className={styles.liveDemand}>
              Demand band: <strong>{formatDemandBand(overview?.demand?.demandBand)}</strong>
            </p>
          </aside>
        </div>
      </section>

      <section id="connectivity" className={styles.section}>
        <div className={styles.sectionHeading}>
          <p>Platform Connectivity</p>
          <h2>How Rydinex keeps rider and driver experiences aligned.</h2>
        </div>
        <div className={styles.pillarGrid}>
          {connectionPillars.map((pillar, index) => (
            <article key={pillar.title} className={styles.pillarCard} style={{ animationDelay: `${0.1 + index * 0.08}s` }}>
              <h3>{pillar.title}</h3>
              <p>{pillar.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="airports" className={styles.section}>
        <div className={styles.sectionHeading}>
          <p>Airport Opportunity Layer</p>
          <h2>Peak flight windows for O Hare and Midway are shared to both apps.</h2>
        </div>
        <div className={styles.airportGrid}>
          {(overview?.airportPeakWindows || []).map(window => (
            <article key={`${window.airportCode}-${window.title}`} className={styles.airportCard}>
              <p className={styles.airportCode}>{window.airportCode}</p>
              <h3>{window.title}</h3>
              <p>{window.airportName}</p>
              <span>{window.localWindow} local time</span>
            </article>
          ))}
        </div>
      </section>

      <section id="apps" className={styles.section}>
        <div className={styles.sectionHeading}>
          <p>App Bridge</p>
          <h2>Launch rider and driver apps from one web command center.</h2>
        </div>
        <div className={styles.appGrid}>
          <article className={styles.appCard}>
            <h3>Rider App Entry</h3>
            <p>Open booking and trip tracking directly with deep links, then fallback to web when needed.</p>
            <div className={styles.appActions}>
              <a href={riderDeepLink} className={styles.primaryCta}>
                Open Rider App
              </a>
              <Link href={riderFallbackPath} className={styles.secondaryCta}>
                Rider web fallback
              </Link>
            </div>
          </article>

          <article className={styles.appCard}>
            <h3>Driver App Entry</h3>
            <p>Jump into online mode, queue tools, and earnings controls from the same web bridge.</p>
            <div className={styles.appActions}>
              <a href={driverDeepLink} className={styles.primaryCta}>
                Open Driver App
              </a>
              <Link href={driverFallbackPath} className={styles.secondaryCta}>
                Driver web fallback
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <p>Trip Lifecycle</p>
          <h2>Every ride follows one synchronized control flow.</h2>
        </div>
        <div className={styles.roadmapGrid}>
          {roadmap.map(item => (
            <article key={item.step} className={styles.roadmapCard}>
              <span>{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <p>Domain: rydinex.com</p>
        <p>Apps: Rydinex Rider | Rydinex Driver</p>
        <p>Control plane: Rydinex Operations Console</p>
      </footer>
    </main>
  );
}
