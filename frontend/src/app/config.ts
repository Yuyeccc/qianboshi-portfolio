export const runtimeMode =
  import.meta.env.VITE_DATA_MODE === "snapshot" ? "snapshot" : "live";

const basePath = import.meta.env.BASE_URL || "/";

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  (runtimeMode === "snapshot" ? `${basePath}snapshots` : "/api");

export const appConfig = {
  runtimeMode,
  apiBaseUrl,
  basePath,
} as const;
