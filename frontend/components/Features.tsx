import { MapPin, Zap, BarChart3, Users, Shield, Smartphone } from 'lucide-react'

export default function Features() {
  const features = [
    {
      icon: <MapPin className="w-12 h-12 text-primary" />,
      title: 'Real-Time Tracking',
      description: 'See your driver\'s live location and estimated arrival time updated every second.',
    },
    {
      icon: <Zap className="w-12 h-12 text-primary" />,
      title: 'Surge Pricing Map',
      description: 'View surge zones in real-time with color-coded heat maps showing demand levels.',
    },
    {
      icon: <BarChart3 className="w-12 h-12 text-primary" />,
      title: 'Airport Queue System',
      description: 'Smart queue management at airports with real-time wait times and flight integration.',
    },
    {
      icon: <Users className="w-12 h-12 text-primary" />,
      title: 'Professional Drivers',
      description: 'Rydinex Black offers luxury service with verified chauffeurs and premium vehicles.',
    },
    {
      icon: <Shield className="w-12 h-12 text-primary" />,
      title: 'Safety First',
      description: 'Background checks, insurance verification, and 24/7 emergency support.',
    },
    {
      icon: <Smartphone className="w-12 h-12 text-primary" />,
      title: 'Mobile App',
      description: 'iOS and Android apps with offline maps, voice navigation, and in-app chat.',
    },
  ]

  return (
    <section id="features" className="py-20 bg-white">
      <div className="container-custom">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="section-title">Powerful Features</h2>
          <p className="section-subtitle">Everything you need for the perfect ride</p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="bg-light rounded-xl p-8 hover:shadow-lg transition hover:scale-105 transform"
            >
              <div className="mb-4">{feature.icon}</div>
              <h3 className="text-xl font-bold text-dark mb-3">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-20">
          {/* Left */}
          <div>
            <h3 className="text-3xl font-bold text-dark mb-6">Why Choose Rydinex?</h3>
            <ul className="space-y-4">
              {[
                'Transparent pricing with no hidden fees',
                'Drivers earn 70% of fares',
                'Available in 15+ major US cities',
                'Airport queue management',
                'Real-time surge pricing',
                'Professional driver verification',
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-secondary rounded-full flex items-center justify-center text-dark text-sm font-bold">
                    ✓
                  </span>
                  <span className="text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right */}
          <div className="bg-gradient-to-br from-primary to-secondary rounded-2xl p-12 text-white">
            <h3 className="text-3xl font-bold mb-6">By The Numbers</h3>
            <div className="space-y-6">
              <div>
                <p className="text-4xl font-bold mb-2">50K+</p>
                <p className="text-lg opacity-90">Active Drivers</p>
              </div>
              <div>
                <p className="text-4xl font-bold mb-2">200K+</p>
                <p className="text-lg opacity-90">Happy Riders</p>
              </div>
              <div>
                <p className="text-4xl font-bold mb-2">5M+</p>
                <p className="text-lg opacity-90">Rides Completed</p>
              </div>
              <div>
                <p className="text-4xl font-bold mb-2">4.8★</p>
                <p className="text-lg opacity-90">Average Rating</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
