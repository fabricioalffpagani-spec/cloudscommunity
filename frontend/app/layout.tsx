import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clouds Community",
  description: "Interface front-end da rede social Clouds Community.",
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
      <body className="min-h-full bg-[var(--bg-root)] text-[var(--text-primary)]">
        {children}
      </body>
    </html>
  );
}
