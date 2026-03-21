import Link from "next/link";

export default function RiderAppLanding() {
  return (
    <main className="min-h-screen bg-[#f7f9f1] p-6 text-[#18212b]">
      <section className="mx-auto max-w-3xl rounded-2xl border border-[#d8e1d2] bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#0f766e]">Rydinex Rider</p>
        <h1 className="mt-2 text-4xl font-extrabold leading-tight">Rider app web fallback</h1>
        <p className="mt-4 text-base text-[#4b5e6f]">
          Open the mobile app for fastest booking, live driver tracking, fare transparency, and trip sharing.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="rydinex://open"
            className="rounded-xl bg-[#0f766e] px-4 py-2 font-bold text-white"
          >
            Open Rider App
          </a>
          <Link href="/connect" className="rounded-xl border border-[#cfd9c9] bg-[#f6faf4] px-4 py-2 font-bold">
            Go to App Connectivity Center
          </Link>
        </div>
      </section>
    </main>
  );
}
