const backendUrl = (process.env.NEXT_PUBLIC_API_TARGET ?? process.env.API_BASE_URL ?? 'https://stafftrack.cloud')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

const isSuper = process.argv.includes('3002') || process.argv.includes('-p 3002') || process.env.PORT === '3002' || process.env.IS_SUPER === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: isSuper ? '.next-super' : '.next',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${backendUrl}/socket.io/:path*`,
      },
      {
        source: '/socket.io',
        destination: `${backendUrl}/socket.io`,
      },
      {
        source: '/uploads/:path+',
        destination: `${backendUrl}/uploads/:path+`,
      },
    ];
  },
};

export default nextConfig;
