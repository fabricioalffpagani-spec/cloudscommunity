import { proxyJsonRequest } from "../../_lib/nest-proxy";

export async function GET(req: Request) {
  const scope = new URL(req.url).searchParams.get("scope");
  return proxyJsonRequest(req, `/clouds/read${scope === "following" ? "?scope=following" : ""}`);
}
