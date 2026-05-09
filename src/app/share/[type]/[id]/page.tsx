import { Metadata } from 'next';
import { getSupabaseAdmin, TABLES } from '@/lib/supabase-db';
import { optimizeImage } from '@/lib/image-optimize';

// ISR: Revalidate shared pages every hour (reduces serverless invocations)
export const revalidate = 3600;

interface PageProps {
  params: Promise<{ type: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { type, id } = await params;

  let title = 'سوق مارع الإلكتروني';
  let description = 'تسوق بكل سهولة وأمان في سوق مارع';
  let imageUrl = '/app-icon.png';

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
        imageUrl = store.logo_url || store.cover_url || imageUrl;
      }
    } else if (type === 'product') {
      const { data: product } = await sb
        .from(TABLES.PRODUCTS)
        .select('name, price, image_url, store:stores(name)')
        .eq('id', id)
        .maybeSingle();
      if (product) {
        const storeName = (product.store as { name: string } | null)?.name || '';
        title = `${product.name} - ${storeName}`;
        description = `${Number(product.price).toLocaleString()} ل.س • ${storeName} • سوق مارع`;
        imageUrl = product.image_url || imageUrl;
      }
    } else if (type === 'offer' || type === 'contest') {
      const { data: offer } = await sb
        .from(TABLES.STORE_OFFERS)
        .select('title, description, image_url, type, store:stores(name)')
        .eq('id', id)
        .maybeSingle();
      if (offer) {
        const storeName = (offer.store as { name: string } | null)?.name || '';
        const label = offer.type === 'contest' ? 'مسابقة' : 'عرض';
        title = `${label}: ${offer.title} - سوق مارع`;
        description = `${offer.description || offer.title} • ${storeName}`;
        imageUrl = offer.image_url || imageUrl;
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
      images: [{ url: imageUrl, width: 1200, height: 630 }],
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

  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Cairo', Tahoma, sans-serif; background: #f0fdf4; direction: rtl; min-height: 100vh; }
          .gradient-dark {
            background: linear-gradient(135deg, #022c22 0%, #064e3b 50%, #065f46 100%);
          }
          .gradient-primary {
            background: linear-gradient(135deg, #059669, #14b8a6);
          }
          .gradient-warm {
            background: linear-gradient(135deg, #f59e0b, #ef4444);
          }
          .gradient-rose {
            background: linear-gradient(135deg, #ec4899, #ef4444);
          }
          .gradient-text-primary {
            background: linear-gradient(135deg, #059669, #14b8a6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          .btn-primary {
            display: flex; align-items: center; justify-content: center; gap: 8px;
            width: 100%; padding: 16px 24px; text-align: center;
            background: linear-gradient(135deg, #059669, #14b8a6); color: white;
            border: none; border-radius: 16px; font-size: 16px; font-weight: 800;
            font-family: 'Cairo', sans-serif; text-decoration: none;
            box-shadow: 0 4px 20px rgba(16, 185, 129, 0.35);
            cursor: pointer; transition: all 0.2s;
          }
          .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(16, 185, 129, 0.4); }
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
          .card {
            background: white; border-radius: 20px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.06);
            border: 1px solid rgba(16, 185, 129, 0.08);
            overflow: hidden;
          }
        `}</style>
      </head>
      <body>
        {/* Hero Section */}
        <div className="gradient-dark" style={{ padding: '48px 24px 96px', position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
          <div style={{ position: 'absolute', top: '-80px', right: '-60px', width: '250px', height: '250px', borderRadius: '50%', background: 'rgba(13, 148, 136, 0.15)', filter: 'blur(60px)' }} />
          <div style={{ position: 'absolute', bottom: '-60px', left: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', filter: 'blur(50px)' }} />
          <div style={{ position: 'absolute', top: '20px', left: '40%', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.06)', filter: 'blur(40px)' }} />
          <div style={{ position: 'relative', zIndex: 10 }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '24px', overflow: 'hidden', margin: '0 auto 20px', boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)', border: '3px solid rgba(255,255,255,0.1)' }}>
              <img src="/app-icon.png" alt="سوق مارع" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h1 style={{ color: 'white', fontSize: '28px', fontWeight: 900, marginBottom: '8px' }}>
              انضم إلى سوق مارع الآن
            </h1>
            <p style={{ color: 'rgba(94, 234, 212, 0.6)', fontSize: '15px', fontWeight: 500 }}>
              سوقك الإلكتروني المحلي • تسوق بكل سهولة وأمان
            </p>
          </div>
        </div>

        {/* Features */}
        <div style={{ marginTop: '-48px', position: 'relative', zIndex: 20, padding: '0 20px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {[
                { emoji: '🏪', text: 'اكتشف المتاجر المحلية', color: '#059669' },
                { emoji: '🛒', text: 'اشتري وبع بسهولة', color: '#0d9488' },
                { emoji: '📤', text: 'شارك المنتجات والعروض', color: '#d97706' },
                { emoji: '💰', text: 'اربح من متجرك الخاص', color: '#7c3aed' },
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px' }}>
                  <span style={{ fontSize: '24px' }}>{f.emoji}</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#022c22' }}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Shared Item Preview */}
        {data && !error && (
          <div style={{ padding: '16px 20px' }}>
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#6ee7b7', letterSpacing: '0.5px', background: '#ecfdf5', padding: '4px 12px', borderRadius: '20px', display: 'inline-block' }}>
                {data.type === 'store' ? '🏪 محتوى مشترك - متجر' : data.type === 'product' ? '🛍️ محتوى مشترك - منتج' : data.type === 'offer' ? '🎁 محتوى مشترك - عرض' : '🏆 محتوى مشترك - مسابقة'}
              </span>
            </div>
            <div className="card">
              {/* Image */}
              {data.image_url && (
                <div style={{ height: '220px', overflow: 'hidden', background: 'linear-gradient(135deg, rgba(16,185,129,0.05), rgba(20,184,166,0.05))', position: 'relative' }}>
                  <img src={optimizeImage(data.image_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {(data.is_featured || data.is_new) && (
                    <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px' }}>
                      {data.is_new && <span className="gradient-primary" style={{ color: 'white', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>✨ جديد</span>}
                      {data.is_featured && <span className="gradient-warm" style={{ color: 'white', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>⭐ مميز</span>}
                    </div>
                  )}
                  {data.is_verified && (
                    <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                      <span style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', fontSize: '10px', fontWeight: 800, padding: '4px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>✓ متجر موثق</span>
                    </div>
                  )}
                </div>
              )}

              {/* Info */}
              <div style={{ padding: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#022c22', marginBottom: '8px', lineHeight: 1.4 }}>
                  {data.name || data.title}
                </h2>
                {data.store_name && (
                  <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🏪 {data.store_name}
                    {data.is_verified && <span style={{ fontSize: '12px', color: '#d97706', fontWeight: 700 }}>✓ موثق</span>}
                  </p>
                )}
                {data.price && (
                  <p className="gradient-text-primary" style={{ fontSize: '20px', fontWeight: 900, marginBottom: '8px' }}>
                    💰 {Number(data.price).toLocaleString('ar-SY')} ل.س
                  </p>
                )}
                {data.discount && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fef3c7', color: '#d97706', fontSize: '13px', fontWeight: 700, padding: '6px 14px', borderRadius: '10px', marginBottom: '8px', border: '1px solid #fde68a' }}>
                    🔥 خصم {data.discount}
                  </div>
                )}
                {data.description && (
                  <p style={{ fontSize: '14px', color: '#475569', marginTop: '10px', lineHeight: 1.8, marginBottom: '10px' }}>{data.description}</p>
                )}
                {data.products_count !== undefined && (
                  <div style={{ display: 'flex', gap: '16px', marginTop: '10px', padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                    <span style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>📦 {data.products_count} منتج</span>
                    <span style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>👥 {data.followers_count || 0} متابع</span>
                    {data.is_featured && <span style={{ fontSize: '13px', color: '#d97706', fontWeight: 600 }}>⭐ متجر مميز</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={{ padding: '20px' }}>
            <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</p>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#022c22', marginBottom: '8px' }}>لم يتم العثور على المحتوى</h3>
              <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: 1.6 }}>ربما تم حذف هذا العنصر أو الرابط غير صحيح</p>
            </div>
          </div>
        )}

        {/* CTA Buttons */}
        <div style={{ padding: '16px 20px 32px' }}>
          <a href="/" className="btn-primary" style={{ marginBottom: '10px' }}>
            🚀 فتح التطبيق الآن
          </a>
          <a href="/?signup=true" className="btn-secondary" style={{ marginBottom: '24px' }}>
            📱 إنشاء حساب جديد
          </a>

          {/* Stats */}
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '10px' }}>لماذا سوق مارع؟</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
              {[
                { value: '+1000', label: 'متجر ومتجر' },
                { value: '+5000', label: 'منتج متوفر' },
                { value: 'مجاني', label: 'التسجيل' },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '16px', fontWeight: 900, color: '#059669' }}>{s.value}</p>
                  <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

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
      </body>
    </html>
  );
}
