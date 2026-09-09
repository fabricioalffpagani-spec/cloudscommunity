import { proxyJsonRequest } from "../../../../_lib/nest-proxy";

export const runtime = "nodejs";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await params;
  return proxyJsonRequest(req, `/clouds/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await params;
  // POST to [userId] proxies to /ban endpoint
  return proxyJsonRequest(req, `/clouds/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}/ban`);
}
