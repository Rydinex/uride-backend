import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";

const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || "https://admin.rydinex.com";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(adminUrl),
  title: "Rydinex | Move Better",
  description:
    "Rydinex connects riders and drivers with fast pickups, transparent pricing, and premium trip reliability.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Rydinex Admin",
    description:
      "Rydinex admin workspace for operations, live maps, rider support, and dispatch oversight.",
    url: adminUrl,
    siteName: "Rydinex Admin",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sora.variable} ${manrope.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
