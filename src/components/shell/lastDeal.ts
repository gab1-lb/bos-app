const KEY = 'bos.lastDeal';

export function getLastDeal(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function setLastDeal(id: string) {
  try { localStorage.setItem(KEY, id); } catch { /* stockage indisponible */ }
}
