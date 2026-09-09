import type { Metadata } from "next";

const inviteImage = "/logo_clouds.png";
const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "Entre no Clouds Community",
  description: "Junte-se à comunidade Clouds.",
  openGraph: {
    title: "Entre no Clouds Community",
    description: "Junte-se à comunidade Clouds.",
    url: `${siteOrigin}/entrenoclouds`,
    siteName: "Clouds Community",
    type: "website",
    images: [{ url: inviteImage, width: 1200, height: 630, alt: "Clouds Community" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Entre no Clouds Community",
    description: "Junte-se à comunidade Clouds.",
    images: [inviteImage],
  },
};

export default function InviteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
