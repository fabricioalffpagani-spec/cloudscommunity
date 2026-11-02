export const GUEST_CLOUD_LIMIT_CODE = "GUEST_CLOUD_LIMIT_REACHED";

type ApiErrorPayload = {
  code?: string;
  message?: string;
};

export class ApiResponseError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiResponseError";
  }
}

export async function readJsonResponse<T>(response: Response, fallbackMessage = "Falha ao carregar dados."): Promise<T> {
  const payload = (await response.json().catch(() => null)) as (T & ApiErrorPayload) | null;
  if (!response.ok || !payload) {
    throw new ApiResponseError(payload?.message ?? fallbackMessage, response.status, payload?.code);
  }
  return payload;
}

export function isGuestCloudLimitError(error: unknown): boolean {
  if (!(error instanceof ApiResponseError)) return false;
  return error.code === GUEST_CLOUD_LIMIT_CODE
    || (error.status === 401 && error.message.includes("até cinco Clouds"));
}
