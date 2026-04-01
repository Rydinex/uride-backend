"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin/airport", label: "Overview" },
  { href: "/admin/airport/queues", label: "Queues & Staging" },
  { href: "/admin/airport/violations", label: "Violations" },
];

export default function AdminAirportNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 rounded-xl border border-neutral-200 bg-white p-2">
      {links.map(link => {
        const isActive = pathname === link.href;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
