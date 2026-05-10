import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { PwaInstallListener } from "@/components/PwaInstallListener";
import "./globals.css";

// Revalidate layout every 5 minutes — the HTML shell is static,
// client-side data is fetched via API routes with their own caching.
export const revalidate = 300;

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://suq-shamel.vercel.app'),
  title: {
    default: 'سوق شامل الإلكتروني | تسوق بكل سهولة وأمان',
    template: '%s | سوق شامل',
  },
  description: 'سوق شامل الإلكتروني - تسوق بكل سهولة وأمان. منتجات متنوعة، متاجر محلية، عروض حصرية وأسعار مناسبة.',
  keywords: ['سوق شامل', 'تسوق إلكتروني', 'متاجر محلية', 'منتجات', 'عروض', 'شامل'],
  authors: [{ name: 'سوق شامل' }],
  creator: 'سوق شامل',
  publisher: 'سوق شامل',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'ar_SY',
    siteName: 'سوق شامل الإلكتروني',
    title: 'سوق شامل الإلكتروني',
    description: 'تسوق بكل سهولة وأمان - منتجات متنوعة ومتاجر محلية',
  },
  twitter: {
    card: 'summary',
    title: 'سوق شامل الإلكتروني',
    description: 'تسوق بكل سهولة وأمان',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: '/manifest.json',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛒</text></svg>",
    apple: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛒</text></svg>",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#f59e0b',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/*
          Service Worker Migration Script — runs BEFORE React hydrates.
          Detects old Service Workers (from "سوق الحرية" era), unregisters them,
          clears all caches, and reloads the page so fresh JS bundles are loaded.
          Uses localStorage flag to ensure this only runs once.
        */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var k='suq-shamel-sw-migration-v2';if(localStorage.getItem(k))return;if(!('serviceWorker' in navigator))return;localStorage.setItem(k,'1');navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return r.unregister()}))}).then(function(){return caches.keys()}).then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k)}))}).then(function(){window.location.reload()})}catch(e){}})()` }} />
      </head>
      <body className={`${cairo.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey="suq-shamel-theme"
        >
          <PwaInstallListener />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
