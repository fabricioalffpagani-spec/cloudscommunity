import { resolveBackendOrigin } from "../api/_lib/nest-proxy";

export type InvitationPreview = { displayName: string; username: string; avatarUrl: string | null };

export async function getInvitationPreview(code: string): Promise<InvitationPreview | null> {
  if (!/^[a-z0-9]{1,7}$/i.test(code)) return null;
  try {
    const response = await fetch(`${resolveBackendOrigin()}/users/invitation-preview/${encodeURIComponent(code)}`, { cache: "no-store" });
    if (!response.ok) return null;
    const result = await response.json() as { ok?: boolean; profile?: InvitationPreview };
    return result.ok && result.profile ? result.profile : null;
  } catch { return null; }
}
