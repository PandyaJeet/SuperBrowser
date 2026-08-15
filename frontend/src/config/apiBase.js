export function getApiBase() {
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/+$/, '');
  }

  if (typeof window !== "undefined" && window.superBrowserDesktop?.isElectron) {
    return (
      import.meta.env.VITE_API_BASE_ELECTRON ||
      window.superBrowserDesktop?.backendUrl ||
      "http://127.0.0.1:8000"
    ).replace(/\/+$/, '');
  }

  const hostname = window.location.hostname;
  if (hostname === "localhost") {
    return "http://localhost:8000";
  }

  if (hostname.includes(".app.github.dev")) {
    return window.location.origin.replace(
      /-\d+\.app\.github\.dev/,
      "-8000.app.github.dev",
    );
  }

  const currentUrl = new URL(window.location.href);
  if (currentUrl.port) {
    currentUrl.port = "8000";
    return currentUrl.origin;
  }

  // Production deployments default to a same-origin API/rewrite. A separately
  // hosted backend should be supplied through VITE_API_BASE.
  return window.location.origin;
}
