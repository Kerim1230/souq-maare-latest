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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://suq-maraa.com'),
  title: {
    default: 'سوق مارع الإلكتروني | تسوق بكل سهولة وأمان',
    template: '%s | سوق مارع',
  },
  description: 'سوق مارع الإلكتروني - تسوق بكل سهولة وأمان. منتجات متنوعة، متاجر محلية، عروض حصرية وأسعار مناسبة.',
  keywords: ['سوق مارع', 'تسوق إلكتروني', 'متاجر محلية', 'منتجات', 'عروض', 'مارع'],
  authors: [{ name: 'سوق مارع' }],
  creator: 'سوق مارع',
  publisher: 'سوق مارع',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'ar_SY',
    siteName: 'سوق مارع الإلكتروني',
    title: 'سوق مارع الإلكتروني',
    description: 'تسوق بكل سهولة وأمان - منتجات متنوعة ومتاجر محلية',
  },
  twitter: {
    card: 'summary',
    title: 'سوق مارع الإلكتروني',
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
      <body className={`${cairo.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey="suq-mara3-theme"
        >
          <PwaInstallListener />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
