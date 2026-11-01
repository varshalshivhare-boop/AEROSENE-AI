import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AeroSense AI — Satellite Environmental Intelligence',
  description:
    'Satellite-driven platform estimating surface PM2.5, visualizing air-quality patterns, CPCB ground stations, and HCHO hotspots across India.',
  keywords: [
    'air quality', 'PM2.5', 'AQI', 'India', 'CPCB', 'HCHO', 'satellite',
    'environmental intelligence', 'pollution monitoring',
  ],
  authors: [{ name: 'AeroSense AI' }],
  robots: 'index, follow',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#020b18',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased">{children}</body>
    </html>
  );
}
