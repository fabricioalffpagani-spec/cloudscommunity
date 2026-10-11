import { proxyJsonRequest } from "../../_lib/nest-proxy";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return proxyJsonRequest(req, "/notifications/push-subscriptions");
}

export async function DELETE(req: Request) {
  return proxyJsonRequest(req, "/notifications/push-subscriptions");
}
