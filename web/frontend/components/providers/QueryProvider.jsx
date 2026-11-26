import { QueryClient, QueryClientProvider } from "react-query";

// Created once: a client made during render would drop the cache on every re-render.
const client = new QueryClient();

/**
 * Sets up the QueryClientProvider from react-query.
 * @desc See: https://react-query.tanstack.com/reference/QueryClientProvider#_top
 */
export function QueryProvider({ children }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
