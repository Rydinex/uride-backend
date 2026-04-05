import Link from "next/link";
import { fetchNetworkOverview } from "./lib/networkOverview";
import styles from "./page.module.css";

const connectionPillars = [
  {
    title: "Rider demand intelligence",
    detail: "Booking intent, pickup precision, and fare transparency stream into one normalized request lane.",
  },
  {
    title: "Driver heartbeat grid",
    detail: "Online state, queue status, and trip telemetry refresh continuously for stable dispatch.",
  },
  {
    title: "Admin control plane",
    detail: "Safety, compliance, payout control, and demand tuning are orchestrated from one desktop surface.",
  },
];

const desktopModules = [
  {
    tag: "Rider",
    title: "Rider Experience",
    detail: "Booking flow, safety hub, teen safeguards, and transparent fare stack.",
    href: "/rider-app",
    cta: "Open Rider Panel",
  },
  {
    tag: "Driver",
    title: "Driver Operations",
    detail: "Realtime requests, airport queues, event hubs, and earnings controls.",
    href: "/driver-app",
    cta: "Open Driver Panel",
  },
  {
    tag: "Admin",
    title: "Admin Console",
    detail: "Executive metrics, compliance controls, driver/rider operations, and export tooling.",
    href: "/admin",
    cta: "Open Admin Console",
  },
];

const riderUpdates = [
  "Expanded ride selection and fair pay badge coverage",
  "Live tracking + safety hub with airport pickup signal flow",
  "Reservations and multi-stop readiness in one flow",
];

const driverUpdates = [
  "Updated surge-aware dashboard and strategic positioning",
  "Airport queues, wait timer, and destination planning",
  "Safety dashboard, vehicle audit, and support appointment tools",
];

const adminUpdates = [
  "Executive overview with financial and system health indicators",
  "Driver/rider management hubs and trip log analytics",
  "Compliance, access approvals, audit logs, and expansion workflows",
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

  const riderFallbackPath = overview?.appBridge?.rider?.fallbackPath || "/rider-app";
  const driverFallbackPath = overview?.appBridge?.driver?.fallbackPath || "/driver-app";

  return (
    <main className={styles.page}>
      <section className={styles.desktopShell}>
        <aside className={styles.sideRail}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>RX</span>
            <div>
              <p className={styles.brandName}>Rydinex Desktop</p>
              <p className={styles.brandSub}>Platform Controller</p>
            </div>
          </div>

          <nav className={styles.nav}>
            <a href="#desktop">Desktop Overview</a>
            <a href="#modules">Module Hub</a>
            <a href="#updates">PRD Updates</a>
            <a href="#airports">Airport Windows</a>
            <Link href="/connect">Connectivity Center</Link>
            <Link href="/admin">Admin Console</Link>
          </nav>
        </aside>

        <div className={styles.desktopContent}>
          <section id="desktop" className={styles.hero}>
            <div className={styles.heroTop}>
              <p className={styles.kicker}>Desktop Command Center</p>
              <p className={styles.liveText}>{formatGeneratedAt(overview?.generatedAt)}</p>
            </div>
            <h1>Rider, Driver, and Admin dashboards on one desktop workspace.</h1>
            <p>
              Your updated PRD modules are now mapped into a desktop-first control surface so operations can monitor,
              launch, and manage every lane from one screen.
            </p>

            <div className={styles.ctaRow}>
              <Link className={styles.primaryCta} href="/admin">
                Launch Admin Dashboard
              </Link>
              <Link className={styles.secondaryCta} href="/connect">
                Open Connectivity Center
              </Link>
            </div>

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
                <span>Live trips</span>
              </article>
              <article>
                <p>{formatPercent(overview?.reliability?.completionRate24h)}</p>
                <span>Completion (24h)</span>
              </article>
            </div>

            <p className={styles.liveDemand}>Demand band: {formatDemandBand(overview?.demand?.demandBand)}</p>
          </section>

          <section id="modules" className={styles.section}>
            <div className={styles.sectionHeading}>
              <p>Module Hub</p>
              <h2>Desktop launch surfaces for Rider, Driver, and Admin operations.</h2>
            </div>

            <div className={styles.moduleGrid}>
              {desktopModules.map(module => (
                <article key={module.title} className={styles.moduleCard}>
                  <span className={styles.moduleTag}>{module.tag}</span>
                  <h3>{module.title}</h3>
                  <p>{module.detail}</p>
                  <Link href={module.href} className={styles.moduleAction}>
                    {module.cta}
                  </Link>
                </article>
              ))}
            </div>
          </section>

          <section id="updates" className={styles.section}>
            <div className={styles.sectionHeading}>
              <p>PRD Integration</p>
              <h2>Latest rider, driver, and admin items now tracked in desktop view.</h2>
            </div>

            <div className={styles.updateGrid}>
              <article className={styles.updateCard}>
                <h3>Rider updates</h3>
                <ul>
                  {riderUpdates.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <Link href={riderFallbackPath} className={styles.inlineLink}>
                  Open rider fallback
                </Link>
              </article>

              <article className={styles.updateCard}>
                <h3>Driver updates</h3>
                <ul>
                  {driverUpdates.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <Link href={driverFallbackPath} className={styles.inlineLink}>
                  Open driver fallback
                </Link>
              </article>

              <article className={styles.updateCard}>
                <h3>Admin updates</h3>
                <ul>
                  {adminUpdates.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <Link href="/admin" className={styles.inlineLink}>
                  Open admin console
                </Link>
              </article>
            </div>
          </section>

          <section id="connectivity" className={styles.section}>
            <div className={styles.sectionHeading}>
              <p>Connection Fabric</p>
              <h2>How all apps stay synchronized in one operational stream.</h2>
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
              <h2>Peak flight windows distributed across rider and driver experiences.</h2>
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
        </div>
      </section>

      <footer className={styles.footer}>
        <p>Desktop mode enabled</p>
        <p>Apps: Rider | Driver | Admin</p>
        <p>Rydinex operations workspace</p>
      </footer>
    </main>
  );
}
