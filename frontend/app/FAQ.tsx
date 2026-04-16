'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const faqs = [
    {
      category: 'For Riders',
      questions: [
        {
          q: 'How do I book a ride?',
          a: 'Download the Rydinex app, enter your pickup and dropoff locations, select your preferred service tier (Rydinex, Comfort, or XL), and confirm your booking. A driver will be assigned within seconds.',
        },
        {
          q: 'What is the average pickup time?',
          a: 'Average pickup time is 3-5 minutes in most areas. During peak hours or in less populated areas, it may take longer.',
        },
        {
          q: 'How is pricing calculated?',
          a: 'Pricing is based on base fare, distance, time, and current demand (surge pricing). You\'ll see the estimated fare before booking.',
        },
        {
          q: 'Can I schedule a ride in advance?',
          a: 'Yes, you can schedule rides up to 30 days in advance. A driver will be assigned 15 minutes before your scheduled time.',
        },
        {
          q: 'What payment methods do you accept?',
          a: 'We accept credit cards, debit cards, digital wallets (Apple Pay, Google Pay), and Rydinex credits.',
        },
      ],
    },
    {
      category: 'For Drivers',
      questions: [
        {
          q: 'How much can I earn?',
          a: 'Drivers earn 70% of fares after credit card and city fees. Average earnings are $25-35/hour, with potential to earn $5,000+ per month.',
        },
        {
          q: 'What are the vehicle requirements?',
          a: 'Vehicles must be 2016 or newer, pass inspection, have valid insurance, and be in good condition. Different tiers (Standard, Comfort, XL) have specific vehicle requirements.',
        },
        {
          q: 'How do I get paid?',
          a: 'You can withdraw earnings weekly. Payments are processed via direct deposit or debit card within 1-2 business days.',
        },
        {
          q: 'Do I need a commercial license?',
          a: 'For standard Rydinex, a valid driver\'s license is sufficient. For Rydinex Black, a chauffeur license and city livery card are required.',
        },
        {
          q: 'What if I have an accident?',
          a: 'All drivers are covered by commercial insurance. Report the incident immediately through the app, and our support team will assist you.',
        },
      ],
    },
    {
      category: 'General',
      questions: [
        {
          q: 'Is Rydinex available in my city?',
          a: 'Rydinex is currently available in 15+ major US cities including Chicago, New York, Los Angeles, San Francisco, Boston, and more. Check our app for availability in your area.',
        },
        {
          q: 'How do you ensure driver safety?',
          a: 'All drivers undergo background checks, vehicle inspections, and insurance verification. Riders can share trip details and use emergency features.',
        },
        {
          q: 'What is Rydinex Black?',
          a: 'Rydinex Black is our premium service with professional chauffeurs, luxury vehicles, and higher service standards. Drivers earn more and riders pay premium prices.',
        },
        {
          q: 'How do I report a problem?',
          a: 'Use the in-app support feature to report issues. Our 24/7 support team will investigate and resolve problems within 24-48 hours.',
        },
        {
          q: 'Do you have a referral program?',
          a: 'Yes! Refer friends and earn credits. Both riders and drivers can participate in our referral program for extra earnings.',
        },
      ],
    },
  ]

  return (
    <section className="py-20 bg-light">
      <div className="container-custom">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-subtitle">Find answers to common questions</p>
        </div>

        {/* FAQ Tabs */}
        <div className="space-y-12">
          {faqs.map((section, sectionIdx) => (
            <div key={sectionIdx}>
              <h3 className="text-2xl font-bold text-dark mb-6">{section.category}</h3>
              <div className="space-y-4">
                {section.questions.map((item, idx) => {
                  const uniqueIdx = sectionIdx * 100 + idx
                  return (
                    <div
                      key={idx}
                      className="bg-white rounded-lg shadow-md overflow-hidden"
                    >
                      <button
                        onClick={() => setOpenIndex(openIndex === uniqueIdx ? null : uniqueIdx)}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-light transition"
                      >
                        <h4 className="text-lg font-semibold text-dark text-left">{item.q}</h4>
                        <ChevronDown
                          size={24}
                          className={`text-primary transition-transform flex-shrink-0 ${
                            openIndex === uniqueIdx ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {openIndex === uniqueIdx && (
                        <div className="px-6 py-4 bg-light border-t border-gray-200">
                          <p className="text-gray-600 leading-relaxed">{item.a}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <p className="text-gray-600 mb-4">Still have questions?</p>
          <button className="btn-primary">Contact Support</button>
        </div>
      </div>
    </section>
  )
}
