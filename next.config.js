/** @type {import('next').NextConfig} */

const nextConfig = {
  /* Other config options */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'barcode.tec-it.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ibb.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.qrserver.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'scontent.fosm5-2.fna.fbcdn.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images2.imgix.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'store.ashley.sa',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.freepik.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.rencdn.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.pinimg.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'logos-world.net',
        port: '',
        pathname: '/**',
      }
    ],
  },
  allowedDevOrigins: [
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://0.0.0.0:3001',
    'http://localhost:9002',
    '*.cloudworkstations.dev',
    '*.cluster-*.cloudworkstations.dev'
  ],
  
  async headers() {
    return [
      {
        source: '/ashley-attendance.apk',
        headers: [
          { key: 'Content-Type', value: 'application/vnd.android.package-archive' },
          { key: 'Content-Disposition', value: 'attachment; filename="ashley-attendance.apk"' },
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/setting',
        destination: '/settings',
        permanent: true,
      },
      {
        source: '/report-designer',
        destination: '/settings?tab=pdf',
        permanent: true,
      },
      {
        source: '/admin/gps-matrix',
        destination: '/gps',
        permanent: true,
      },
      {
        source: '/attendance',
        destination: '/attendance/checkin',
        permanent: true,
      },
      {
        source: '/login',
        destination: '/adminpanel',
        permanent: true,
      },
      {
        source: '/ashley-expenses-settings',
        destination: '/ashley-expenses',
        permanent: true,
      },
      {
        source: '/inputs',
        destination: '/ashley-expenses',
        permanent: true,
      },
      {
        source: '/pdf-archive',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/items',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/locations',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/warehouse-map',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/huana-map',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/ashley-map',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/map-management',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/import',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/import-pdf',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/new-file',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/sold-items',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/archive',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/archive/:id*',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/public-inventory',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/public-transmit',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/pdf/:path*',
        destination: '/admin',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
