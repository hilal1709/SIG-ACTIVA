 import type { Metadata } from "next";
import "./globals.css";
import AuthGuard from "./components/AuthGuard";

export const metadata: Metadata = {
  title: "Dashboard - PT Semen Indonesia Grup",
  description: "Visualisasi data dan ringkasan aktivitas akuntan",
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
