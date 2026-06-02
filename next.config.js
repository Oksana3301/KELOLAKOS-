/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,  // ⚠️ skip TS errors saat build
  },
  eslint: {
    ignoreDuringBuilds: true, // ⚠️ skip ESLint warnings
  },
};

module.exports = nextConfig;
