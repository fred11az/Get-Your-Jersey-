import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  // Sharp est chargé nativement par les routes de rendu : il ne doit pas être
  // bundlé par Turbopack/webpack.
  serverExternalPackages: ['sharp'],

  async headers() {
    return [
      {
        // Mockups et police de flocage : versionnés par leur contenu, cache long.
        source: '/kits/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
