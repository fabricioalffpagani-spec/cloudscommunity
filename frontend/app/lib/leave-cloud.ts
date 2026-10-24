export async function leaveCloud(
  cloudId: string,
  isAuthor: boolean,
): Promise<void> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(
      `/api/clouds/${encodeURIComponent(cloudId)}/${isAuthor ? "exit" : "leave"}`,
      { method: "POST", credentials: "include", signal: controller.signal },
    );
    if (!response.ok) {
      const body = (
        typeof response.json === "function"
          ? await response.json().catch(() => null)
          : null
      ) as {
        message?: string;
      } | null;
      throw new Error(
        body?.message || "Não foi possível sair da Cloud. Tente novamente.",
      );
    }
    window.dispatchEvent(
      new CustomEvent("clouds:membership-changed", { detail: { cloudId } }),
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error("A saída demorou demais. Tente novamente.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
