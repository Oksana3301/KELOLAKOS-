/** @type {import('next').NextConfig} */
const nextConfig = {
  // Reduce bundle size, enable strict mode
  reactStrictMode: true,
  // Allow image domains if needed (for kwitansi logos, etc)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'drive.google.com' },
    ],
  },
};

module.exports = nextConfig;
