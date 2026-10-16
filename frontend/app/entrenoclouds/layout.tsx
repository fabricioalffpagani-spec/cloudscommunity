import type { Metadata } from "next";

const inviteImage = "/logo_clouds.png";
const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const title = "Clouds Community";
const description = "Converse sobre o que realmente importa. Conversas públicas e ao vivo.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    url: `${siteOrigin}/entrenoclouds`,
    siteName: "Clouds Community",
    type: "website",
    images: [{ url: inviteImage, width: 1200, height: 630, alt: "Clouds Community" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [inviteImage],
  },
};

export default function InviteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
