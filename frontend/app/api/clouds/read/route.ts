import { proxyJsonRequest } from "../../_lib/nest-proxy";

export async function GET(req: Request) {
  const searchParams = new URL(req.url).searchParams;
  const params = new URLSearchParams();
  if (searchParams.get("scope") === "following") params.set("scope", "following");
  const offset = searchParams.get("offset");
  if (offset && /^\d+$/.test(offset)) params.set("offset", offset);
  const query = params.toString();
  return proxyJsonRequest(req, `/clouds/read${query ? `?${query}` : ""}`);
}
