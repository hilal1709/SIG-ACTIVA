 import type { Metadata, Viewport } from "next";
import "./globals.css";
import AuthGuard from "./components/AuthGuard";

export const metadata: Metadata = {
  title: "Dashboard - SIG ACTIVA",
  description: "Sistem Informasi Akuntansi PT Semen Indonesia Grup",
  icons: {
    icon: "/logo sig.png",
    apple: "/logo sig.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthGuard>
          {children}
        </AuthGuard>
      </body>
    </html>
  );
}
