import { ArchivedConversation } from "../../../components/ArchivedConversation";

export default async function ArchivedConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ArchivedConversation cloudId={id} />;
}
