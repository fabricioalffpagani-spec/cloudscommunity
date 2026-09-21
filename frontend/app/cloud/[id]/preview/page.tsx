import { CloudPreview } from "../../../components/CloudPreview";

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CloudPreview cloudId={id} />;
}
