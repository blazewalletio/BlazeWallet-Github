import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BLAZE Admin Dashboard",
  description: "Analytics dashboard for BLAZE Wallet administrators",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

