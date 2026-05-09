import type { MetadataRoute } from 'next'
import { getSupabaseAdmin, TABLES, handleResponse } from '@/lib/supabase-db'

export const revalidate = 3600; // Revalidate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  // Static routes
  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ]

  // Dynamic routes from Supabase
  try {
    const sb = getSupabaseAdmin()

    // Fetch verified stores
    const stores = handleResponse(
      await sb.from(TABLES.STORES).select('id, updated_at').eq('is_verified', true).order('updated_at', { ascending: false }).limit(1000),
      'sitemap-stores'
    )

    for (const store of stores) {
      routes.push({
        url: `${baseUrl}/share/store/${store.id}`,
        lastModified: store.updated_at ? new Date(store.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })
    }

    // Fetch products
    const products = handleResponse(
      await sb.from(TABLES.PRODUCTS).select('id, updated_at').order('updated_at', { ascending: false }).limit(1000),
      'sitemap-products'
    )

    for (const product of products) {
      routes.push({
        url: `${baseUrl}/share/product/${product.id}`,
        lastModified: product.updated_at ? new Date(product.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })
    }
  } catch {
    // Fallback to static routes only
  }

  return routes
}
