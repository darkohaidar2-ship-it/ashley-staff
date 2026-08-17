
import { type Metadata, type Viewport } from "next";
import './globals.css';
import '@carbon/styles/css/styles.css';
import { ClientLayout } from './client-layout';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: "Ashley Nexus Hub | سیستەمی ئاشڵی",
  description: "Advanced ERP & Attendance System",
  icons: {
    icon: [
      {
        url: "/icon.png",
        href: "/icon.png",
      },
    ],
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/png" href="/icon.png" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
      </head>
      <body className="antialiased min-h-screen" suppressHydrationWarning>
        <ClientLayout>
            {children}
        </ClientLayout>
      </body>
    </html>
  );
}
