/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Root domain → halaman publik /info (di edge, sebelum render/cache).
  async redirects() {
    return [
      { source: '/', destination: '/info', permanent: false },
    ];
  },
};

module.exports = nextConfig;
