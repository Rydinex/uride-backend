import Link from "next/link";

export default function DriverAppLanding() {
  return (
    <main className="min-h-screen bg-[#f5f8ff] p-6 text-[#101a27]">
      <section className="mx-auto max-w-3xl rounded-2xl border border-[#d7dfea] bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#0369a1]">Rydinex Driver</p>
        <h1 className="mt-2 text-4xl font-extrabold leading-tight">Driver app web fallback</h1>
        <p className="mt-4 text-base text-[#485a6d]">
          Open the mobile app to go online, receive realtime requests, track airport opportunities, and manage payouts.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="rydinex-driver://open"
            className="rounded-xl bg-[#0369a1] px-4 py-2 font-bold text-white"
          >
            Open Driver App
          </a>
          <Link href="/connect" className="rounded-xl border border-[#cfd9e6] bg-[#f3f8ff] px-4 py-2 font-bold">
            Go to App Connectivity Center
          </Link>
        </div>
      </section>
    </main>
  );
}
