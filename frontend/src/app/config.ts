export const runtimeMode =
  import.meta.env.VITE_DATA_MODE === "snapshot" ? "snapshot" : "live";

const basePath = import.meta.env.BASE_URL || "/";

// snapshot 模式强制走 {basePath}snapshots（不受 .env.local 的 VITE_API_BASE_URL 干扰）
export const apiBaseUrl =
  runtimeMode === "snapshot"
    ? `${basePath}snapshots`
    : import.meta.env.VITE_API_BASE_URL || "/api";

export const appConfig = {
  runtimeMode,
  apiBaseUrl,
  basePath,
} as const;
