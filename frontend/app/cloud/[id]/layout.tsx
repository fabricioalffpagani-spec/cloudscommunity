import type { Metadata } from "next";

const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const title = "Clouds Community";
const description = "Conversas públicas e ao vivo sobre tudo. Entre na conversa.";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return {
  title,
  description,
  openGraph: {
    title,
    description,
    url: `${siteOrigin}/cloud/${encodeURIComponent(id)}?join=1`,
    siteName: "Clouds Community",
    type: "website",
    images: [
      {
        url: "/cloud-conversation-invite.png",
        width: 1024,
        height: 1024,
        alt: "Conversas no Clouds Community",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/cloud-conversation-invite.png"],
  },
  };
}

export default function CloudLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
