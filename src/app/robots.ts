import type { MetadataRoute } from 'next'

// Static content — revalidate every 24 hours
export const revalidate = 86400;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/share/'],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://suq-maraa.com'}/sitemap.xml`,
  }
}
