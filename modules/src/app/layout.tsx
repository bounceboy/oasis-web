import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  weight: ['300', '400', '500', '600'],
  subsets: ["latin"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "OASIS — Onsite & Offsite AI Powered Supervisory System",
  description: "Platform pengawasan perusahaan asuransi, reasuransi, dan pialang — didukung AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={poppins.variable}>
      <body>
        {/* Aurora backdrop */}
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ position: 'absolute', top: -220, left: '35%', width: 820, height: 680, background: 'radial-gradient(closest-side, rgba(28,90,190,0.55), transparent 70%)', filter: 'blur(70px)' }} />
          <div style={{ position: 'absolute', top: -120, right: -160, width: 640, height: 640, background: 'radial-gradient(closest-side, rgba(46,230,200,0.28), transparent 70%)', filter: 'blur(80px)' }} />
          <div style={{ position: 'absolute', top: 280, left: -200, width: 560, height: 560, background: 'radial-gradient(closest-side, rgba(69,230,97,0.12), transparent 70%)', filter: 'blur(90px)' }} />
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          {children}
        </div>
      </body>
    </html>
  );
}
