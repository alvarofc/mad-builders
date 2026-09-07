export const PAGE_SIZE = 50;

export function pageNumber(value: string | number | null = null) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 && page <= 1_000_000 ? page : 1;
}
