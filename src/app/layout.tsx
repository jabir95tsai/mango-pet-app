import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mango-pet.app";
const LOGO_IMAGE = "/icons/mango-pet-logo.png";
const SOCIAL_IMAGE = "/og-image.jpg";
const PWA_ICON_192 = "/web-app-manifest-192x192.png";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Mango Pet — 芒果寵物",
    template: "%s · Mango Pet",
  },
  description:
    "一站式寵物照護與社交平台：紀錄寵物生活、找寵物友善餐廳、參與遛狗排行榜、與其他飼主交流。",
  manifest: "/manifest.json?v=20260524",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mango Pet",
  },
  openGraph: {
    title: "Mango Pet — 芒果寵物",
    description:
      "紀錄寵物生活、找寵物友善餐廳、參與遛狗排行榜、與其他飼主交流。",
    type: "website",
    locale: "zh_TW",
    siteName: "Mango Pet",
    images: [{ url: SOCIAL_IMAGE, width: 1200, height: 630, alt: "Mango Pet" }],
  },
  twitter: {
    card: "summary",
    title: "Mango Pet — 芒果寵物",
    description: "Your pet life companion.",
    images: [SOCIAL_IMAGE],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
      { url: PWA_ICON_192, type: "image/png", sizes: "192x192" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" },
    ],
  },
  other: {
    "msapplication-TileColor": "#F59E0B",
    "msapplication-TileImage": "/mstile-150x150.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#F59E0B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-zinc-900 dark:text-zinc-100">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
