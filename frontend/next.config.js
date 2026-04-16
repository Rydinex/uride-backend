/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  pageExtensions: ['js', 'jsx'],
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig
