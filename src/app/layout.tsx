
import { type Metadata } from "next";
import './globals.css';
import '@carbon/styles/css/styles.css';
import { ClientLayout } from './client-layout';

export const metadata: Metadata = {
  title: "Ashley Nexus Hub",
  description: "Advanced ERP System",
  icons: {
    icon: [
      {
        url: "https://logos-world.net/wp-content/uploads/2022/04/Ashley-Emblem.png",
        href: "https://logos-world.net/wp-content/uploads/2022/04/Ashley-Emblem.png",
      },
    ],
    shortcut: "https://logos-world.net/wp-content/uploads/2022/04/Ashley-Emblem.png",
    apple: "https://logos-world.net/wp-content/uploads/2022/04/Ashley-Emblem.png",
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
        <link rel="icon" type="image/png" href="https://logos-world.net/wp-content/uploads/2022/04/Ashley-Emblem.png" />
        <link rel="shortcut icon" type="image/png" href="https://logos-world.net/wp-content/uploads/2022/04/Ashley-Emblem.png" />
      </head>
      <body className="antialiased min-h-screen" suppressHydrationWarning>
        <ClientLayout>
            {children}
        </ClientLayout>
      </body>
    </html>
  );
}
