import type { Metadata } from "next";
import { InvitationRedirect } from "../components/InvitationRedirect";
import { getInvitationPreview } from "../lib/invitation-preview";
import { generalInvitationText } from "../lib/cloud-invitation";

type Props = { searchParams: Promise<{ ref?: string; preview?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const ref = params.ref ?? "";
  const profile = await getInvitationPreview(ref);
  const description = generalInvitationText(profile?.displayName || profile?.username);
  const image = `/entrenoclouds/preview?ref=${encodeURIComponent(ref)}${params.preview === "avatar" ? "&style=avatar&v=2" : ""}`;
  return { title: "Clouds Community", description, openGraph: { title: "Clouds Community", description, images: [{ url: image, width: 600, height: 600 }] }, twitter: { card: "summary", title: "Clouds Community", description, images: [image] } };
}

export default function EnterCloudsPage() {
  return <InvitationRedirect />;
}
