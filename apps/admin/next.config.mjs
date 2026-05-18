const backendUrl = (process.env.NEXT_PUBLIC_API_TARGET ?? process.env.API_BASE_URL ?? 'https://stafftrack.cloud')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
