import { Metadata } from 'next';
import { getSupabaseAdmin, TABLES } from '@/lib/supabase-db';
import { optimizeImage } from '@/lib/image-optimize';

// ISR: Revalidate shared pages every hour (reduces serverless invocations)
export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://souq-maare-latest.vercel.app';
const DEFAULT_OG_IMAGE = `${BASE_URL}/app-icon.png`;

interface PageProps {
  params: Promise<{ type: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { type, id } = await params;

  let title = 'سوق مارع الإلكتروني';
  let description = 'تسوق بكل سهولة وأمان في سوق مارع';
  let imageUrl = DEFAULT_OG_IMAGE;

  try {
    const sb = getSupabaseAdmin();

    if (type === 'store') {
      const { data: store } = await sb
        .from(TABLES.STORES)
        .select('name, description, logo_url, cover_url')
        .eq('id', id)
        .maybeSingle();
      if (store) {
        title = `${store.name} - سوق مارع`;
        description = store.description || `${store.name} في سوق مارع الإلكتروني`;
        const rawImage = store.logo_url || store.cover_url;
        imageUrl = rawImage ? optimizeImage(rawImage, { width: 1200, height: 630, crop: 'fill' }) : DEFAULT_OG_IMAGE;
      }
    } else if (type === 'product') {
      const { data: product } = await sb
        .from(TABLES.PRODUCTS)
        .select('name, price, image_url, store:stores(name)')
        .eq('id', id)
        .maybeSingle();
      if (product) {
        const storeName = ((product.store as unknown as { name: string } | null)?.name) || '';
        title = `${product.name} - ${storeName}`;
        description = `${Number(product.price).toLocaleString()} ل.س • ${storeName} • سوق مارع`;
        imageUrl = product.image_url ? optimizeImage(product.image_url, { width: 1200, height: 630, crop: 'fill' }) : DEFAULT_OG_IMAGE;
      }
    } else if (type === 'offer' || type === 'contest') {
      const { data: offer } = await sb
        .from(TABLES.STORE_OFFERS)
        .select('title, description, image_url, type, store:stores(name)')
        .eq('id', id)
        .maybeSingle();
      if (offer) {
        const storeName = ((offer.store as unknown as { name: string } | null)?.name) || '';
        const label = offer.type === 'contest' ? 'مسابقة' : 'عرض';
        title = `${label}: ${offer.title} - سوق مارع`;
        description = `${offer.description || offer.title} • ${storeName}`;
        imageUrl = offer.image_url ? optimizeImage(offer.image_url, { width: 1200, height: 630, crop: 'fill' }) : DEFAULT_OG_IMAGE;
      }
    }
  } catch { /* ignore db errors */ }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'ar_SY',
      siteName: 'سوق مارع الإلكتروني',
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function SharePage({ params }: PageProps) {
  const { type, id } = await params;

  let data: any = null;
  let error = false;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/share/data?type=${type}&id=${id}`);
    if (res.ok) {
      data = await res.json();
    } else {
      error = true;
    }
  } catch {
    error = true;
  }

  // Determine type label and colors
  const typeConfig: Record<string, { label: string; emoji: string; color: string; gradientFrom: string; gradientTo: string }> = {
    store: { label: 'متجر', emoji: '🏪', color: '#059669', gradientFrom: '#059669', gradientTo: '#0d9488' },
    product: { label: 'منتج', emoji: '🛍️', color: '#0d9488', gradientFrom: '#0d9488', gradientTo: '#059669' },
    offer: { label: 'عرض', emoji: '🎁', color: '#d97706', gradientFrom: '#d97706', gradientTo: '#f59e0b' },
    contest: { label: 'مسابقة', emoji: '🏆', color: '#e11d48', gradientFrom: '#e11d48', gradientTo: '#ec4899' },
  };
  const cfg = typeConfig[type] || typeConfig.product;
  const hasImage = data?.image_url;

  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Cairo', Tahoma, sans-serif; background: #f8faf9; direction: rtl; min-height: 100vh; }
          .btn-primary {
            display: flex; align-items: center; justify-content: center; gap: 8px;
            width: 100%; padding: 16px 24px; text-align: center;
            background: linear-gradient(135deg, #059669, #14b8a6); color: white;
            border: none; border-radius: 16px; font-size: 17px; font-weight: 800;
            font-family: 'Cairo', sans-serif; text-decoration: none;
            box-shadow: 0 6px 24px rgba(16, 185, 129, 0.35);
            cursor: pointer; transition: all 0.2s;
          }
          .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(16, 185, 129, 0.45); }
          .btn-primary:active { transform: translateY(0); }
          .btn-secondary {
            display: flex; align-items: center; justify-content: center; gap: 8px;
            width: 100%; padding: 14px 24px; text-align: center;
            background: white; color: #059669; border: 2px solid #d1fae5;
            border-radius: 16px; font-size: 14px; font-weight: 700;
            font-family: 'Cairo', sans-serif; text-decoration: none;
            cursor: pointer; transition: all 0.2s;
          }
          .btn-secondary:hover { background: #ecfdf5; border-color: #a7f3d0; }
        `}</style>
      </head>
      <body>
        {data && !error ? (
          // ── Item Found: Beautiful Preview ──
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Hero Image Section */}
            <div style={{
              position: 'relative',
              height: hasImage ? '380px' : '280px',
              background: hasImage
                ? 'linear-gradient(to bottom, transparent 60%, #f8faf9 100%)'
                : `linear-gradient(135deg, ${cfg.gradientFrom}, ${cfg.gradientTo})`,
              overflow: 'hidden',
            }}>
              {hasImage ? (
                <>
                  <img
                    src={optimizeImage(data.image_url, { width: 800, height: 600 })}
                    alt={data.name || data.title}
                    style={{
                      width: '100%', height: '100%', objectFit: 'cover',
                    }}
                  />
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
                    background: 'linear-gradient(to bottom, transparent, #f8faf9)',
                  }} />
                </>
              ) : (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  height: '100%', gap: '12px',
                }}>
                  <span style={{ fontSize: '64px', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.2))' }}>{cfg.emoji}</span>
                  <span style={{
                    fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.8)',
                    background: 'rgba(255,255,255,0.15)', padding: '4px 16px', borderRadius: '20px',
                    backdropFilter: 'blur(8px)',
                  }}>
                    {cfg.label}
                  </span>
                </div>
              )}

              {/* Type Badge — overlaid on image */}
              {hasImage && (
                <div style={{
                  position: 'absolute', top: '16px', right: '16px', zIndex: 10,
                  background: `linear-gradient(135deg, ${cfg.gradientFrom}, ${cfg.gradientTo})`,
                  color: 'white', fontSize: '12px', fontWeight: 800,
                  padding: '6px 14px', borderRadius: '12px',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  backdropFilter: 'blur(8px)',
                }}>
                  <span>{cfg.emoji}</span> {cfg.label}
                </div>
              )}

              {/* Verified / Featured Badges */}
              {hasImage && (data.is_featured || data.is_new) && (
                <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', gap: '6px', zIndex: 10 }}>
                  {data.is_new && <span style={{ background: 'linear-gradient(135deg, #059669, #14b8a6)', color: 'white', fontSize: '11px', fontWeight: 700, padding: '5px 12px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>✨ جديد</span>}
                  {data.is_featured && <span style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: 'white', fontSize: '11px', fontWeight: 700, padding: '5px 12px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>⭐ مميز</span>}
                </div>
              )}
            </div>

            {/* Content Card — overlaps image */}
            <div style={{ marginTop: hasImage ? '-60px' : '0', position: 'relative', zIndex: 20, padding: '0 20px', flex: 1 }}>
              <div style={{
                background: 'white', borderRadius: '24px',
                boxShadow: '0 4px 32px rgba(0,0,0,0.06)',
                border: '1px solid rgba(16, 185, 129, 0.08)',
                overflow: 'hidden', padding: '24px',
              }}>
                {/* Name */}
                <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#022c22', marginBottom: '10px', lineHeight: 1.4 }}>
                  {data.name || data.title}
                </h1>

                {/* Store Name */}
                {data.store_name && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '8px',
                      background: `linear-gradient(135deg, ${cfg.gradientFrom}22, ${cfg.gradientTo}22)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: '14px' }}>🏪</span>
                    </div>
                    <span style={{ fontSize: '15px', color: '#475569', fontWeight: 700 }}>{data.store_name}</span>
                    {data.is_verified && (
                      <span style={{
                        fontSize: '11px', color: '#d97706', fontWeight: 800,
                        background: '#fef3c7', padding: '3px 8px', borderRadius: '6px',
                        border: '1px solid #fde68a',
                      }}>✓ موثق</span>
                    )}
                  </div>
                )}

                {/* Price */}
                {data.price && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    background: `linear-gradient(135deg, ${cfg.gradientFrom}11, ${cfg.gradientTo}11)`,
                    border: `1px solid ${cfg.gradientFrom}22`,
                    padding: '10px 18px', borderRadius: '14px', marginBottom: '12px',
                  }}>
                    <span style={{ fontSize: '14px' }}>💰</span>
                    <span style={{ fontSize: '22px', fontWeight: 900, color: cfg.color }}>
                      {Number(data.price).toLocaleString('ar-SY')}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: cfg.color }}>ل.س</span>
                  </div>
                )}

                {/* Discount */}
                {data.discount && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    background: '#fef3c7', color: '#d97706', fontSize: '15px', fontWeight: 800,
                    padding: '8px 16px', borderRadius: '12px', marginBottom: '12px',
                    border: '1px solid #fde68a', marginLeft: data.price ? '8px' : '0',
                  }}>
                    🔥 خصم {data.discount}
                  </div>
                )}

                {/* Description */}
                {data.description && (
                  <p style={{
                    fontSize: '15px', color: '#475569', marginTop: '12px',
                    lineHeight: 1.9, marginBottom: '12px',
                    padding: '12px', background: '#f8faf9', borderRadius: '12px',
                    border: '1px solid #f1f5f9',
                  }}>
                    {data.description}
                  </p>
                )}

                {/* Store Stats */}
                {data.products_count !== undefined && (
                  <div style={{
                    display: 'flex', gap: '16px', marginTop: '12px', padding: '14px',
                    background: '#f8faf9', borderRadius: '14px', border: '1px solid #f1f5f9',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '16px' }}>📦</span>
                      <span style={{ fontSize: '14px', color: '#475569', fontWeight: 700 }}>{data.products_count} منتج</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '16px' }}>👥</span>
                      <span style={{ fontSize: '14px', color: '#475569', fontWeight: 700 }}>{data.followers_count || 0} متابع</span>
                    </div>
                    {data.is_featured && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '16px' }}>⭐</span>
                        <span style={{ fontSize: '14px', color: '#d97706', fontWeight: 700 }}>متجر مميز</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* CTA Buttons */}
            <div style={{ padding: '20px 20px 24px' }}>
              <a href="/" className="btn-primary" style={{ marginBottom: '10px' }}>
                🚀 فتح في سوق مارع
              </a>
              <a href="/?signup=true" className="btn-secondary" style={{ marginBottom: '16px' }}>
                📱 إنشاء حساب مجاني
              </a>

              {/* Footer */}
              <div style={{ textAlign: 'center', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '8px', overflow: 'hidden' }}>
                    <img src="/app-icon.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#022c22' }}>سوق مارع الإلكتروني</span>
                </div>
                <p style={{ fontSize: '11px', color: '#cbd5e1' }}>
                  © {new Date().getFullYear()} جميع الحقوق محفوظة
                </p>
              </div>
            </div>
          </div>
        ) : (
          // ── Item Not Found ──
          <div style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: '24px',
            background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
          }}>
            <div style={{
              background: 'white', borderRadius: '24px', padding: '48px 32px',
              textAlign: 'center', maxWidth: '400px', width: '100%',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
              border: '1px solid rgba(16, 185, 129, 0.08)',
            }}>
              <span style={{ fontSize: '56px', marginBottom: '16px', display: 'block' }}>🔍</span>
              <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#022c22', marginBottom: '8px' }}>لم يتم العثور على المحتوى</h3>
              <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: 1.8, marginBottom: '24px' }}>ربما تم حذف هذا العنصر أو الرابط غير صحيح</p>
              <a href="/" className="btn-primary">🚀 افتح سوق مارع</a>
            </div>
          </div>
        )}
      </body>
    </html>
  );
}
