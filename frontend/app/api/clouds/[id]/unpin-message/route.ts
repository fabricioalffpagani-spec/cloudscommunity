import { proxyJsonRequest } from "../../../_lib/nest-proxy";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  console.log("Unpin request:", { id, path: `/clouds/${encodeURIComponent(id)}/unpin-message` });
  return proxyJsonRequest(req, `/clouds/${encodeURIComponent(id)}/unpin-message`);
}
