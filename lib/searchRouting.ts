export function buildSearchResultsRoute(searchText: string) {
  const trimmed = searchText?.trim() ?? '';

  return {
    pathname: '/search-results' as const,
    params: { query: trimmed },
  };
}
