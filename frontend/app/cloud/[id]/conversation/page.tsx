import { ArchivedConversation } from "../../../components/ArchivedConversation";
import { Suspense } from "react";

export default async function ArchivedConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={null}><ArchivedConversation cloudId={id} /></Suspense>;
}
