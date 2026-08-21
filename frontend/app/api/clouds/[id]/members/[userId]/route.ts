import { proxyJsonRequest } from "../../../../_lib/nest-proxy";

export const runtime = "nodejs";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await params;
  return proxyJsonRequest(req, `/clouds/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`);
}
