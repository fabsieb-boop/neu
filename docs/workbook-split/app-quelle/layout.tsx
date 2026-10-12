import './globals.css';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'TVF Altwert',
  description: 'Controlling Cockpit der TVF ALTWERT GmbH',
  applicationName: 'TVF Altwert',
  manifest: '/api/pwa/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ALTWERT',
  },
  icons: {
    icon: [
      { url: '/api/pwa/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/api/pwa/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/api/pwa/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/api/pwa/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0c0e12',
};

const STARTBILDER: [string, string][] = [
  ['/api/pwa/splash/750x1334.png', '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)'],
  ['/api/pwa/splash/828x1792.png', '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)'],
  ['/api/pwa/splash/1170x2532.png', '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)'],
  ['/api/pwa/splash/1179x2556.png', '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)'],
  ['/api/pwa/splash/1206x2622.png', '(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)'],
  ['/api/pwa/splash/1284x2778.png', '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)'],
  ['/api/pwa/splash/1290x2796.png', '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)'],
  ['/api/pwa/splash/1320x2868.png', '(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)'],
  ['/api/pwa/splash/1536x2048.png', '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)'],
];

/* Der Zustand der Seitenspalte wird gesetzt, bevor das erste Bild steht.
   Als Effekt in React kaeme er einen Rahmen zu spaet – die offene Leiste
   waere kurz zu sehen und wuerde dann wegspringen. */
const NAV_ZUSTAND =
  "try{document.documentElement.dataset.nav=localStorage.getItem('nav')==='zu'?'zu':'auf'}catch(e){}";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" data-nav="auf">
      <head>
        <script dangerouslySetInnerHTML={{ __html: NAV_ZUSTAND }} />
        {STARTBILDER.map(([href, media]) => (
          <link key={href} rel="apple-touch-startup-image" href={href} media={media} />
        ))}
      </head>
      <body>
        {children}
        <Script src="/api/pwa/install.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
