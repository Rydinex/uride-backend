import { TrendingUp, Shield, Calendar, Zap } from 'lucide-react'

export default function ForDrivers() {
  const benefits = [
    {
      icon: <TrendingUp className="w-8 h-8 text-secondary" />,
      title: 'Earn Up to $5,000/Month',
      description: 'Drivers earn 70% of every ride. Bonus opportunities during surge pricing. No hidden fees.',
    },
    {
      icon: <Shield className="w-8 h-8 text-secondary" />,
      title: 'Full Protection',
      description: 'Commercial insurance coverage, 24/7 support, and driver protection program included.',
    },
    {
      icon: <Calendar className="w-8 h-8 text-secondary" />,
      title: 'Flexible Schedule',
      description: 'Work whenever you want. No minimum hours or shift requirements. You\'re in control.',
    },
    {
      icon: <Zap className="w-8 h-8 text-secondary" />,
      title: 'Real-Time Earnings',
      description: 'See your earnings in real-time. Get paid weekly with instant withdrawal options.',
    },
  ]

  const requirements = [
    { label: 'Valid Driver\'s License', icon: '📋' },
    { label: 'Insurance', icon: '🛡️' },
    { label: 'Background Check', icon: '✓' },
    { label: 'Vehicle Inspection', icon: '🔍' },
    { label: 'Drug Test', icon: '🧪' },
    { label: '2016+ Vehicle', icon: '🚗' },
  ]

  return (
    <section id="drivers" className="py-20 bg-white">
      <div className="container-custom">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="section-title">For Drivers</h2>
          <p className="section-subtitle">Turn your car into income</p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          {benefits.map((benefit, idx) => (
            <div key={idx} className="bg-light rounded-xl p-8 hover:shadow-lg transition">
              <div className="mb-4">{benefit.icon}</div>
              <h3 className="text-xl font-bold text-dark mb-3">{benefit.title}</h3>
              <p className="text-gray-600">{benefit.description}</p>
            </div>
          ))}
        </div>

        {/* Earnings Breakdown */}
        <div className="bg-gradient-to-r from-primary to-secondary rounded-2xl p-12 text-white mb-20">
          <h3 className="text-3xl font-bold mb-8">How You Earn</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <p className="text-5xl font-bold mb-2">100%</p>
              <p className="text-lg opacity-90">Rider Pays</p>
              <p className="text-sm opacity-75">Full fare amount</p>
            </div>
            <div className="flex items-center justify-center">
              <div className="text-center">
                <p className="text-3xl font-bold mb-2">↓</p>
                <p className="text-lg opacity-90">Rydinex Platform</p>
                <p className="text-sm opacity-75">Keeps 30%</p>
              </div>
            </div>
            <div className="text-center">
              <p className="text-5xl font-bold mb-2">70%</p>
              <p className="text-lg opacity-90">You Earn</p>
              <p className="text-sm opacity-75">After credit card & city fees</p>
            </div>
          </div>
        </div>

        {/* Requirements */}
        <div className="mb-16">
          <h3 className="text-2xl font-bold text-dark mb-8">Basic Requirements</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {requirements.map((req, idx) => (
              <div key={idx} className="bg-light rounded-lg p-6 text-center">
                <p className="text-4xl mb-2">{req.icon}</p>
                <p className="font-semibold text-dark">{req.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <h3 className="text-3xl font-bold text-dark mb-4">Ready to Start Earning?</h3>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Join thousands of drivers already earning with Rydinex. Sign up today and start driving tomorrow.
          </p>
          <button className="btn-primary">Become a Driver</button>
        </div>
      </div>
    </section>
  )
}
