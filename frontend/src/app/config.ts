export const runtimeMode =
  import.meta.env.VITE_DATA_MODE === "snapshot" ? "snapshot" : "live";

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  (runtimeMode === "snapshot" ? "/snapshots" : "/api");

export const appConfig = {
  runtimeMode,
  apiBaseUrl,
} as const;
