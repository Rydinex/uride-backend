import { MapPin, Clock, DollarSign, Users } from 'lucide-react'

export default function ForRiders() {
  const tiers = [
    {
      name: 'Rydinex',
      description: 'Affordable everyday rides',
      price: '$2.50 base fare',
      features: ['Standard vehicles', 'Real-time tracking', 'Professional drivers', 'Safety verified'],
      icon: '🚗',
      color: 'bg-blue-100',
    },
    {
      name: 'Rydinex Comfort',
      description: 'Premium comfort and space',
      price: '$4.50 base fare',
      features: ['Larger vehicles', 'Extra legroom', 'Premium drivers', 'Bottled water'],
      icon: '🚙',
      color: 'bg-purple-100',
      popular: true,
    },
    {
      name: 'Rydinex XL',
      description: 'Group rides made easy',
      price: '$6.50 base fare',
      features: ['SUVs & vans', 'Seats 5-6 people', 'Extra storage', 'Group discounts'],
      icon: '🚕',
      color: 'bg-green-100',
    },
  ]

  const features = [
    {
      icon: <MapPin className="w-8 h-8 text-primary" />,
      title: 'Real-Time Tracking',
      description: 'See your driver\'s location in real-time with live updates every second.',
    },
    {
      icon: <Clock className="w-8 h-8 text-primary" />,
      title: 'Instant Pickup',
      description: 'Average pickup time of 3-5 minutes in most areas.',
    },
    {
      icon: <DollarSign className="w-8 h-8 text-primary" />,
      title: 'Transparent Pricing',
      description: 'Know your fare before you book. No hidden charges.',
    },
    {
      icon: <Users className="w-8 h-8 text-primary" />,
      title: 'Verified Drivers',
      description: 'All drivers pass background checks and vehicle inspections.',
    },
  ]

  return (
    <section id="riders" className="py-20 bg-light">
      <div className="container-custom">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="section-title">For Riders</h2>
          <p className="section-subtitle">Choose your perfect ride</p>
        </div>

        {/* Service Tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {tiers.map((tier, idx) => (
            <div
              key={idx}
              className={`rounded-2xl p-8 transition-transform hover:scale-105 ${
                tier.popular
                  ? 'bg-white shadow-2xl border-2 border-primary'
                  : 'bg-white shadow-lg'
              }`}
            >
              {tier.popular && (
                <div className="bg-primary text-white px-4 py-1 rounded-full inline-block mb-4 text-sm font-semibold">
                  Most Popular
                </div>
              )}

              <div className={`text-5xl mb-4 ${tier.color} w-16 h-16 rounded-xl flex items-center justify-center`}>
                {tier.icon}
              </div>

              <h3 className="text-2xl font-bold text-dark mb-2">{tier.name}</h3>
              <p className="text-gray-600 mb-4">{tier.description}</p>
              <p className="text-lg font-semibold text-primary mb-6">{tier.price}</p>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="text-secondary">✓</span>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <button className={tier.popular ? 'btn-primary w-full' : 'btn-outline w-full'}>
                Get Started
              </button>
            </div>
          ))}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, idx) => (
            <div key={idx} className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition">
              <div className="mb-4">{feature.icon}</div>
              <h4 className="text-lg font-semibold text-dark mb-2">{feature.title}</h4>
              <p className="text-gray-600 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
