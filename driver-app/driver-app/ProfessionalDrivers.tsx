
import { Crown, Briefcase, Award, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useEffect } from 'react'
import Image from 'next/image'

export default function ProfessionalDrivers() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [autoPlay, setAutoPlay] = useState(true)

  const slides = [
    {
      image: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663481211186/M3naZgut3fyWC3RpZuYVC6/rydinex-black-lincoln-navigator-driver-gQ9nUpyxYmGrvFiWrWtBdH.webp',
      title: 'Lincoln Navigator',
      description: 'Premium Black SUV with professional driver'
    },
    {
      image: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663481211186/M3naZgut3fyWC3RpZuYVC6/rydinex-black-reservation-assist-huhtzJH5VtTR7Pcg5QQxwn.webp',
      title: 'Mercedes-Benz Service',
      description: 'Luxury sedan with white-glove service'
    }
  ]

  useEffect(() => {
    if (!autoPlay) return
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [autoPlay, slides.length])

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length)
    setAutoPlay(false)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
    setAutoPlay(false)
  }

  const features = [
    {
      icon: <Crown className="w-8 h-8 text-yellow-500" />,
      title: 'Premium Service',
      description: 'Rydinex Black offers luxury rides with professional chauffeurs.',
    },
    {
      icon: <Briefcase className="w-8 h-8 text-yellow-500" />,
      title: 'Higher Earnings',
      description: 'Earn 30-40% more per ride compared to standard Rydinex.',
    },
    {
      icon: <Award className="w-8 h-8 text-yellow-500" />,
      title: 'Professional Status',
      description: 'Verified chauffeur license, commercial insurance, and vehicle standards.',
    },
  ]

  const requirements = [
    'Valid Chauffeur License',
    'Valid Driver\'s License',
    'City Livery Hard Card',
    'Background Check',
    'Commercial Insurance',
    'Profile Photo',
    'Black Car (2020+)',
    'Black SUV (2020+)',
    'Drug Test',
    'Vehicle Inspection',
  ]

  return (
    <section className="py-20 bg-light">
      <div className="container-custom">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="section-title">Rydinex Black</h2>
          <p className="section-subtitle">Premium rideshare for professional drivers</p>
        </div>

        {/* Image Carousel */}
        <div className="mb-20 relative rounded-2xl overflow-hidden shadow-2xl bg-dark">
          <div className="relative h-96 md:h-[500px] w-full">
            {slides.map((slide, idx) => (
              <div
                key={idx}
                className={`absolute inset-0 transition-opacity duration-1000 ${
                  idx === currentSlide ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <img
                  src={slide.image}
                  alt={slide.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}

            {/* Carousel Controls */}