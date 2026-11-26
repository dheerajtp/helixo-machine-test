// Which view the list page shows. No React here, so it runs under node --test.
export function listView({ isLoading, isError, hasData, isPreviousData, count, q, onFirstPage }) {
  if (isLoading) return "loading";
  // Cached rows stay on screen when only a refetch failed.
  if (isError && !hasData) return "error";
  if (count > 0) return "table";
  // Rows kept from the previous query say nothing about the current one yet.
  if (isPreviousData) return "pending";
  return !q && onFirstPage ? "first" : "noMatch";
}

// Only network and server failures are worth repeating; a 4xx will fail the same way.
export const shouldRetry = (failureCount, error) =>
  failureCount < 2 && (error?.status === 0 || error?.status >= 500);
