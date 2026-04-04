export function getApiBase() {
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }

  if (typeof window !== "undefined" && window.superBrowserDesktop?.isElectron) {
    return (
      import.meta.env.VITE_API_BASE_ELECTRON ||
      window.superBrowserDesktop?.backendUrl ||
      "http://127.0.0.1:8000"
    );
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

  return window.location.href.replace(/:\d+.*/, ":8000").replace(/\/$/, "");
}
