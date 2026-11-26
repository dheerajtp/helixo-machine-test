// { timerId: total } from the stats query. Empty while loading or after a failure, so rows show "—".
export function impressionTotals({ data, isError }) {
  if (isError || !data) return {};
  return Object.fromEntries(data.data.map(({ timerId, total }) => [timerId, total]));
}
