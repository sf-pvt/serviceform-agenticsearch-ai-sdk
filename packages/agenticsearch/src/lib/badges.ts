import type { Hit } from '../client/types';

/**
 * Badges on result cards, from the product's tags in the feed ("Outlet",
 * a flag for "Made in Finland"). Which tag gives which badge is the shop's to
 * say, since every shop names its tags its own way.
 */
export interface BadgeRule {
  /** The tag exactly as the feed has it (case does not matter). */
  tag: string;
  /** The words on the badge, and what a flag is called for screen readers. */
  label: string;
  /** A two-letter country code: the badge is that flag instead of words. */
  flag?: string;
}

/** The flags that can be drawn. */
export const FLAGS = ['fi', 'se', 'no', 'dk'];

/**
 * Rules from text, one per line (or separated by ";"):
 *   Label:Outlet = Outlet
 *   Label:Made in Finland = flag:fi
 *   Sale
 * A tag on its own is shown by its own words (what follows its last ":").
 */
export function parseBadges(input: string | BadgeRule[] | undefined | null): BadgeRule[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.filter((r) => r && typeof r.tag === 'string' && r.tag.trim()).map((r) => ({ tag: r.tag.trim(), label: String(r.label || own(r.tag)).trim(), ...(r.flag && FLAGS.includes(String(r.flag).toLowerCase()) ? { flag: String(r.flag).toLowerCase() } : {}) })).slice(0, 24);
  }
  const rules: BadgeRule[] = [];
  for (const line of String(input).split(/[\n;]+/)) {
    const at = line.indexOf('=');
    const tag = (at === -1 ? line : line.slice(0, at)).trim();
    if (!tag) continue;
    const shown = at === -1 ? '' : line.slice(at + 1).trim();
    const flag = /^flag:([a-z]{2})$/i.exec(shown);
    if (flag && FLAGS.includes(flag[1].toLowerCase())) rules.push({ tag, label: own(tag), flag: flag[1].toLowerCase() });
    else rules.push({ tag, label: shown && !flag ? shown : own(tag) });
    if (rules.length >= 24) break;
  }
  return rules;
}

const own = (tag: string): string => {
  const cut = tag.lastIndexOf(':');
  return (cut === -1 ? tag : tag.slice(cut + 1)).trim();
};

/** The feed field the tags are read from. */
export const BADGE_FIELD = 'tags';

/** The badges one result gets, in the order of the rules. */
export function badgesFor(hit: Hit, rules: BadgeRule[]): BadgeRule[] {
  if (!rules.length) return [];
  const raw = hit.fields ? (hit.fields as Record<string, unknown>)[BADGE_FIELD] : null;
  if (!raw) return [];
  // The API sends a list as one text, joined with ", ".
  const tags = (Array.isArray(raw) ? raw.map(String) : String(raw).split(/,\s+/)).map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (!tags.length) return [];
  const has = new Set(tags);
  return rules.filter((rule) => has.has(rule.tag.toLowerCase()));
}
