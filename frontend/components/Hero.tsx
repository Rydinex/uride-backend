import { ArrowRight, Download } from 'lucide-react'

export default function Hero() {
  return (
    <section className="bg-gradient-to-br from-dark via-blue-900 to-dark text-white py-20 md:py-32">
      <div className="container-custom">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Your Ride,
              <span className="gradient-text"> Anytime</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              Experience the future of ridesharing with Rydinex. Real-time tracking, transparent pricing, and professional drivers at your fingertips.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <button className="btn-primary flex items-center justify-center gap-2">
                <Download size={20} />
                Download App
              </button>
              <button className="btn-secondary flex items-center justify-center gap-2">
                Learn More
                <ArrowRight size={20} />
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-3xl font-bold">4.97 ⭐</p>
                <p className="text-gray-400">Average Rating</p>
              </div>
              <div>
                <p className="text-3xl font-bold">1M+</p>
                <p className="text-gray-400">Trusted Users</p>
              </div>
              <div>
                <p className="text-3xl font-bold">15+</p>
                <p className="text-gray-400">Cities</p>
              </div>
            </div>
          </div>

          {/* Right Content - Mock App */}
          <div className="hidden md:flex justify-center">
            <div className="relative w-72 h-96 bg-gradient-to-br from-secondary to-primary rounded-3xl shadow-2xl p-4 flex flex-col items-center justify-center">
              <div className="text-center">
                <p className="text-6xl mb-4">📍</p>
                <h3 className="text-2xl font-bold text-dark mb-2">Find Your Ride</h3>
                <p className="text-dark/80 mb-6">Real-time tracking and live updates</p>
                <div className="space-y-2">
                  <div className="bg-white/20 backdrop-blur rounded-lg p-3 text-left">
                    <p className="text-sm font-semibold">Pickup Location</p>
                    <p className="text-xs opacity-80">San Francisco, CA</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur rounded-lg p-3 text-left">
                    <p className="text-sm font-semibold">Dropoff Location</p>
                    <p className="text-xs opacity-80">Ferry Building</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
