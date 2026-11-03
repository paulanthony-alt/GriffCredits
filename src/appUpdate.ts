// After a new version goes live, a page that was already open still runs the
// old code. When it then loads one of the parts fetched on demand (Trends, the
// PDF report), those old files are gone and the import fails. These helpers
// recognise that case so the app can offer a reload instead of breaking.

const CHUNK_ERROR = [
  /Failed to fetch dynamically imported module/i, // Chrome, Edge
  /error loading dynamically imported module/i, // Firefox
  /Importing a module script failed/i, // Safari
  /Unable to preload CSS/i, // Vite, missing stylesheet
  /Expected a JavaScript.*module script/i,
];

export function isChunkLoadError(e: unknown): boolean {
  const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  return CHUNK_ERROR.some((re) => re.test(message));
}

export const NEW_VERSION_MESSAGE = "A new version of Griff Credits is ready. Reload the page to continue.";

export function reloadApp(): void {
  window.location.reload();
}
