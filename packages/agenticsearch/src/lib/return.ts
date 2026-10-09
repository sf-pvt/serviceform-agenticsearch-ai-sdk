/**
 * What was typed before leaving this tab for a result, so that Back finds it
 * in the field again. Kept per tab, read only when the page is arrived at by
 * Back, and only by the same tool on the same page: a visit through the menu
 * an hour later is a new visit, not a return.
 */
const RETURN_KEY = 'sfas:return';

export interface ReturnNote { q: string; tool: string; page: string }

const here = () => `${window.location.pathname || ''}${window.location.search || ''}`;

export function arrivedByBack(): boolean {
  try {
    const entries = performance.getEntriesByType?.('navigation') as PerformanceNavigationTiming[] | undefined;
    if (entries && entries[0] && entries[0].type) return entries[0].type === 'back_forward';
    const legacy = (performance as unknown as { navigation?: { type: number } }).navigation;
    return !!legacy && legacy.type === 2;
  } catch { return false; }
}

export function keepForReturn(tool: string, q: string): void {
  try {
    if (q.trim()) sessionStorage.setItem(RETURN_KEY, JSON.stringify({ q: q.trim().slice(0, 300), tool, page: here() } satisfies ReturnNote));
    else sessionStorage.removeItem(RETURN_KEY);
  } catch { /* private mode: nothing to keep it in */ }
}

/** The words to put back in the field, once, when this is the way back from a result. */
export function takeReturn(tool: string): string {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    if (!raw) return '';
    const note = JSON.parse(raw) as Partial<ReturnNote>;
    if (!note || typeof note.q !== 'string' || note.tool !== tool || note.page !== here()) return '';
    if (!arrivedByBack()) return '';
    sessionStorage.removeItem(RETURN_KEY);
    return note.q;
  } catch { return ''; }
}
