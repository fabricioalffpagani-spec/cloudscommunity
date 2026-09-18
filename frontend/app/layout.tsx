import type { Metadata } from "next";
import "./globals.css";
import { SessionUserProvider } from "./components/session-user";
import { ScrollbarStyles } from "./components/ScrollbarStyles";
import { AccessibilityProvider } from "./components/AccessibilityProvider";
import { InvitePopupLoader } from "./components/InvitePopupLoader";
import { MobileNavigationTutorial } from "./components/MobileNavigationTutorial";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Clouds Community",
  description: "Interface front-end da rede social Clouds Community.",
  icons: {
    icon: "/clouds_icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className="h-full scroll-smooth antialiased"
    >
      <head>
        <meta charSet="utf-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&family=Space+Grotesk:wght@700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full bg-[var(--bg-root)] text-[var(--text-primary)]">
        <SessionUserProvider>
          <AccessibilityProvider>
            <ScrollbarStyles />
            {children}
            <InvitePopupLoader />
            <MobileNavigationTutorial />
          </AccessibilityProvider>
        </SessionUserProvider>
      </body>
    </html>
  );
}
