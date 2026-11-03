const inFlightRequests = new Map<string, Promise<unknown[]>>();

/** Shares only concurrent feed loads; completed requests remain revalidatable. */
export function requestCloudFeed<T>(endpoint: string): Promise<T[]> {
  const inFlight = inFlightRequests.get(endpoint);
  if (inFlight) return inFlight as Promise<T[]>;

  const request = (async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as {
      clouds?: unknown[];
    } | null;

    if (!response.ok || !Array.isArray(payload?.clouds)) {
      throw new Error("Não foi possível atualizar o feed.");
    }

    return payload.clouds;
  })();

  inFlightRequests.set(endpoint, request);
  const clear = () => {
    if (inFlightRequests.get(endpoint) === request) {
      inFlightRequests.delete(endpoint);
    }
  };
  void request.then(clear, clear);
  return request as Promise<T[]>;
}
