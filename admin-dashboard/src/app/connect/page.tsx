import Link from "next/link";
import { fetchNetworkOverview } from "../lib/networkOverview";
import styles from "./page.module.css";

function formatGeneratedAt(value: string | null): string {
  if (!value) {
    return "Live sync pending";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Live sync pending";
  }

  return `Synced ${parsed.toLocaleString()}`;
}

export default async function ConnectPage() {
  const overview = await fetchNetworkOverview();

  const riderDeepLink = overview?.appBridge?.rider?.deepLink || "rydinex://open";
  const driverDeepLink = overview?.appBridge?.driver?.deepLink || "rydinex-driver://open";
  const riderFallbackPath = overview?.appBridge?.rider?.fallbackPath || "/rider-app";
  const driverFallbackPath = overview?.appBridge?.driver?.fallbackPath || "/driver-app";

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.backLink}>
            Back to Desktop Home
          </Link>
          <Link href="/admin" className={styles.adminLink}>
            Operations Console
          </Link>
        </header>

        <div className={styles.hero}>
          <p className={styles.eyebrow}>Desktop Connectivity Center</p>
          <h1>One desktop bridge for rider, driver, and admin operations.</h1>
          <p>
            This bridge keeps rider demand, driver supply, and operations signals synced in one realtime flow so matching,
            payouts, and airport opportunities stay aligned.
          </p>
          <p className={styles.syncText}>{formatGeneratedAt(overview?.generatedAt || null)}</p>
        </div>

        <div className={styles.actionGrid}>
          <article className={styles.card}>
            <h2>Open Rider App</h2>
            <img src="/rydinex-logo.png" alt="Rydinex rider logo" className={styles.riderLogo} />
            <p>Jump directly into rider booking and trip tracking.</p>
            <a href={riderDeepLink} className={styles.primaryAction}>
              Launch Rider App
            </a>
            <Link href={riderFallbackPath} className={styles.secondaryAction}>
              Web fallback
            </Link>
          </article>

          <article className={styles.card}>
            <h2>Open Driver App</h2>
            <p>Go online, view demand windows, and accept trips fast.</p>
            <a href={driverDeepLink} className={styles.primaryAction}>
              Launch Driver App
            </a>
            <Link href={driverFallbackPath} className={styles.secondaryAction}>
              Web fallback
            </Link>
          </article>

          <article className={styles.card}>
            <h2>Airport Opportunity Windows</h2>
            <p>Peak flight windows are synced to both apps for better positioning.</p>
            <ul className={styles.windowList}>
              {(overview?.airportPeakWindows || []).slice(0, 4).map(window => (
                <li key={`${window.airportCode}-${window.title}`}>
                  <strong>{window.airportCode}</strong> {window.title} ({window.localWindow})
                </li>
              ))}
            </ul>
          </article>
        </div>

        <section className={styles.integrationSteps}>
          <h2>Connection Model</h2>
          <div className={styles.stepGrid}>
            <article>
              <span>1</span>
              <h3>Unified demand feed</h3>
              <p>Rider requests and airport surges stream into a shared matching pipeline.</p>
            </article>
            <article>
              <span>2</span>
              <h3>Driver heartbeat reliability</h3>
              <p>Location heartbeat, queue status, and trip progression refresh every few seconds.</p>
            </article>
            <article>
              <span>3</span>
              <h3>Operational oversight</h3>
              <p>Admin console tracks incidents, compliance, and payout signals in the same timeline.</p>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}
