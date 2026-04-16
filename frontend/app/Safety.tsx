import { CheckCircle, Lock, AlertCircle, Phone } from 'lucide-react'

export default function Safety() {
  const safetyFeatures = [
    {
      icon: <CheckCircle className="w-8 h-8 text-green-500" />,
      title: 'Background Checks',
      description: 'All drivers undergo comprehensive background checks including criminal history and driving records.',
    },
    {
      icon: <Lock className="w-8 h-8 text-green-500" />,
      title: 'Insurance Coverage',
      description: 'Commercial insurance and $1M liability coverage for all rides.',
    },
    {
      icon: <AlertCircle className="w-8 h-8 text-green-500" />,
      title: 'Vehicle Inspection',
      description: 'All vehicles pass rigorous safety inspections before joining the platform.',
    },
    {
      icon: <Phone className="w-8 h-8 text-green-500" />,
      title: '24/7 Support',
      description: 'Round-the-clock customer support with emergency assistance available anytime.',
    },
  ]

  const riderSafety = [
    'Share trip details with emergency contacts',
    'In-app emergency button with direct police dispatch',
    'Driver photo and vehicle details before pickup',
    'Ride receipt and history for all trips',
    'Anonymous feedback and reporting system',
  ]

  const driverSafety = [
    'Rider verification and rating system',
    'Driver protection insurance',
    'Emergency support hotline',
    'Incident reporting and investigation',
    'Dash cam recommendations',
  ]

  return (
    <section id="safety" className="py-20 bg-light">
      <div className="container-custom">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="section-title">Safety & Trust</h2>
          <p className="section-subtitle">Your safety is our priority</p>
        </div>

        {/* Safety Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
          {safetyFeatures.map((feature, idx) => (
            <div key={idx} className="bg-white rounded-xl p-8 shadow-md hover:shadow-lg transition">
              <div className="mb-4">{feature.icon}</div>
              <h3 className="text-lg font-bold text-dark mb-3">{feature.title}</h3>
              <p className="text-gray-600 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Rider vs Driver Safety */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
          {/* Rider Safety */}
          <div className="bg-white rounded-2xl p-12 shadow-lg">
            <h3 className="text-2xl font-bold text-dark mb-8 flex items-center gap-2">
              <span className="text-3xl">👤</span> Rider Safety
            </h3>
            <ul className="space-y-4">
              {riderSafety.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Driver Safety */}
          <div className="bg-white rounded-2xl p-12 shadow-lg">
            <h3 className="text-2xl font-bold text-dark mb-8 flex items-center gap-2">
              <span className="text-3xl">🚗</span> Driver Safety
            </h3>
            <ul className="space-y-4">
              {driverSafety.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="bg-gradient-to-r from-primary to-secondary rounded-2xl p-12 text-white text-center">
          <h3 className="text-3xl font-bold mb-8">Trusted by Millions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <p className="text-4xl font-bold mb-2">4.8★</p>
              <p className="opacity-90">Average Rating</p>
            </div>
            <div>
              <p className="text-4xl font-bold mb-2">99.9%</p>
              <p className="opacity-90">On-Time Pickup</p>
            </div>
            <div>
              <p className="text-4xl font-bold mb-2">100%</p>
              <p className="opacity-90">Verified Drivers</p>
            </div>
            <div>
              <p className="text-4xl font-bold mb-2">24/7</p>
              <p className="opacity-90">Support Available</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
