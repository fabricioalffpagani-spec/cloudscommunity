import { Suspense } from "react";
import { NotificationCloudRedirect } from "../../../components/NotificationCloudRedirect";

export default async function NotificationCloudPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={null}><NotificationCloudRedirect cloudId={id} /></Suspense>;
}
