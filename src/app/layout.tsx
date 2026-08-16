
import { type Metadata } from "next";
import './globals.css';
import '@carbon/styles/css/styles.css';
import { ClientLayout } from './client-layout';

const ashleyBlackFavicon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23000000'/%3E%3Cpath d='M42 46h-6.2v-3.5c-2.4 2.8-5.8 4.2-9.6 4.2-6.5 0-11.2-4.5-11.2-11.2 0-7 5.2-11.2 13.8-11.2h7v-2.2c0-3.6-2.5-5.6-7-5.6-3.8 0-7.2 1.6-9.8 4.2l-3.8-4.6C19 12.2 24 10 30 10c8.8 0 12 4.8 12 12v24zm-6.2-13.6h-6c-4.8 0-7.8 2.2-7.8 6.2 0 3.8 2.8 6 6.8 6 4.4 0 7-2.6 7-6.8v-5.4z' fill='%23ffffff'/%3E%3Crect x='44' y='10' width='8' height='8' rx='1.5' fill='%23f05a28'/%3E%3C/svg%3E";

export const metadata: Metadata = {
  title: "Ashley Nexus Hub | سیستەمی ئاشڵی",
  description: "Advanced ERP & Attendance System",
  icons: {
    icon: [
      {
        url: ashleyBlackFavicon,
        href: ashleyBlackFavicon,
      },
    ],
    shortcut: ashleyBlackFavicon,
    apple: ashleyBlackFavicon,
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
        <link rel="icon" type="image/svg+xml" href={ashleyBlackFavicon} />
        <link rel="apple-touch-icon" href={ashleyBlackFavicon} />
        <link rel="shortcut icon" href={ashleyBlackFavicon} />
      </head>
      <body className="antialiased min-h-screen" suppressHydrationWarning>
        <ClientLayout>
            {children}
        </ClientLayout>
      </body>
    </html>
  );
}
