import { redirect } from "next/navigation";

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/cloud/${id}/conversation`);
}
