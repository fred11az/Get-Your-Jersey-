import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://getyourjersey.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // L'admin et les API n'ont rien à faire dans l'index ; les fichiers
        // clients (photos, aperçus) non plus, ce sont des données personnelles.
        disallow: ['/admin', '/admin/', '/api/'],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
