import type { MetadataRoute } from 'next'

// Static content — revalidate every 24 hours
export const revalidate = 86400;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/'],
      },
      // Allow social media crawlers to access share pages for OG previews
      {
        userAgent: ['facebookexternalhit', 'Facebot', 'Twitterbot', 'WhatsApp', 'TelegramBot', 'Slackbot', 'Discordbot', 'Googlebot'],
        allow: '/share/',
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://suq-shamel.vercel.app'}/sitemap.xml`,
  }
}
