import type { ReactNode } from "react";
import Link from "next/link";
import AdminAirportNav from "@/components/admin-airport/AdminAirportNav";

export default function AdminAirportLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Admin Airport</p>
          <h1 className="text-2xl font-bold text-neutral-900">Airport Operations Dashboard</h1>
        </div>

        <Link href="/admin" className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100">
          Back to Admin Home
        </Link>
      </header>

      <AdminAirportNav />

      {children}
    </main>
  );
}
