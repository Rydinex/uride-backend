import Link from "next/link";

export default function DriverAppLanding() {
  return (
    <main className="min-h-screen bg-[#131314] p-6 text-[#e5e2e3]">
      <section className="mx-auto max-w-4xl rounded-2xl bg-[#1f1f20] p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-[#c2c6d7]">
          <Link href="/" className="rounded-lg bg-[#2a2a2b] px-3 py-2 hover:bg-[#353436]">
            Desktop Home
          </Link>
          <Link href="/connect" className="rounded-lg bg-[#2a2a2b] px-3 py-2 hover:bg-[#353436]">
            Connectivity Center
          </Link>
          <Link href="/admin" className="rounded-lg bg-[#2a2a2b] px-3 py-2 hover:bg-[#353436]">
            Admin Console
          </Link>
        </div>

        <p className="mt-6 text-xs font-bold uppercase tracking-[0.08em] text-[#b1c5ff]">Rydinex Driver</p>
        <h1 className="mt-2 text-4xl font-extrabold leading-tight md:text-5xl">Driver app web fallback</h1>
        <p className="mt-4 text-base text-[#c2c6d7]">
          Open the mobile app to go online, receive realtime requests, track airport opportunities, and manage payouts.
        </p>

        <div className="mt-5 grid gap-2 rounded-xl bg-[#2a2a2b] p-4 text-sm text-[#c2c6d7] md:grid-cols-3">
          <p>Realtime request feed</p>
          <p>Airport and event ops tools</p>
          <p>Earnings and payout controls</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="rydinex-driver://open"
            className="rounded-xl bg-[#276ef1] px-4 py-2 font-bold text-white"
          >
            Open Driver App
          </a>
          <Link href="/connect" className="rounded-xl bg-[#353436] px-4 py-2 font-bold text-[#e5e2e3]">
            Go to App Connectivity Center
          </Link>
        </div>
      </section>
    </main>
  );
}
