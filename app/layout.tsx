import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BLAZE Wallet - Secure DeFi Wallet",
  description: "Secure crypto wallet with DeFi features, biometric authentication, and cross-device sync.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: '/blaze-logo.png', type: 'image/png', sizes: '512x512' },
      { url: '/blaze-logo.png', type: 'image/png', sizes: '192x192' },
      { url: '/blaze-logo.png', type: 'image/png', sizes: '32x32' },
      { url: '/blaze-logo.png', type: 'image/png', sizes: '16x16' }
    ],
    shortcut: '/blaze-logo.png',
    apple: '/blaze-logo.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BLAZE Wallet",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "BLAZE Wallet",
    title: "BLAZE Wallet - Secure DeFi Wallet",
    description: "Secure crypto wallet with DeFi features, biometric authentication, and cross-device sync.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f97316",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body className={inter.className}>
        <ErrorBoundary>
          <div className="h-screen overflow-hidden bg-gray-50">
            <main className="relative h-full overflow-y-auto">
              {children}
            </main>
          </div>
        </ErrorBoundary>
      </body>
    </html>
  );
}



