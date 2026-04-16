import './globals.css'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://rydinex.com'

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Rydinex - Your Ride, Anytime',
  description:
    'Rydinex is a modern rideshare platform connecting riders and drivers. Download now and get your first ride free!',
  keywords: 'rideshare, transportation, rydinex',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Rydinex - Your Ride, Anytime',
    description:
      'Modern rideshare platform with real-time tracking, surge pricing, and professional drivers.',
    url: siteUrl,
    siteName: 'Rydinex',
    type: 'website',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900">
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  )
}
