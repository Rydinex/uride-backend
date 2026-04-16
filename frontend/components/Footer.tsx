import Link from 'next/link'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-dark text-white py-12">
      <div className="container-custom">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Company */}
          <div>
            <h3 className="text-lg font-bold mb-4">Rydinex</h3>
            <p className="text-gray-400 text-sm">
              Modern rideshare platform connecting riders and drivers worldwide.
            </p>
          </div>

          {/* For Riders */}
          <div>
            <h4 className="font-semibold mb-4">For Riders</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="#" className="hover:text-white transition">How it Works</Link></li>
              <li><Link href="#" className="hover:text-white transition">Pricing</Link></li>
              <li><Link href="#" className="hover:text-white transition">Safety</Link></li>
              <li><Link href="#" className="hover:text-white transition">Download App</Link></li>
            </ul>
          </div>

          {/* For Drivers */}
          <div>
            <h4 className="font-semibold mb-4">For Drivers</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="#" className="hover:text-white transition">Become a Driver</Link></li>
              <li><Link href="#" className="hover:text-white transition">Earnings</Link></li>
              <li><Link href="#" className="hover:text-white transition">Requirements</Link></li>
              <li><Link href="#" className="hover:text-white transition">Support</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="#" className="hover:text-white transition">Privacy Policy</Link></li>
              <li><Link href="#" className="hover:text-white transition">Terms of Service</Link></li>
              <li><Link href="#" className="hover:text-white transition">Cookie Policy</Link></li>
              <li><Link href="#" className="hover:text-white transition">Contact Us</Link></li>
            </ul>
          </div>
        </div>

        {/* Social & Copyright */}
        <div className="border-t border-gray-700 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm mb-4 md:mb-0">
              &copy; {currentYear} Rydinex. All rights reserved.
            </p>
            <div className="flex gap-6">
              <a href="#" className="text-gray-400 hover:text-white transition">
                Fb
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition">
                X
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition">
                Ig
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition">
                In
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
