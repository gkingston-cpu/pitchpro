import type { SignalType } from "../types";

// Suffixes that don't help distinguish one firm from another in article text.
const GENERIC_SUFFIX =
  /\s+(&\s+\w+|group|partners|advisory|financial|cpas?|associates|llp|llc|& co\.?)$/i;

/**
 * Find which tracked firm (if any) a piece of text is about. Matches on the
 * full firm name first, then on the distinctive leading portion of the name
 * when it's long enough to be unambiguous.
 */
export function matchCompany(
  text: string,
  companies: { id: number; name: string }[],
): { id: number; name: string } | null {
  const haystack = text.toLowerCase();
  for (const c of companies) {
    if (haystack.includes(c.name.toLowerCase())) return c;
  }
  for (const c of companies) {
    const stem = c.name.replace(GENERIC_SUFFIX, "").trim().toLowerCase();
    if (stem.length >= 8 && haystack.includes(stem)) return c;
  }
  return null;
}

// Keyword → signal-type rules used to pre-classify news items before synthesis
// (the synthesis agent has the final say on type/headline/pitch).
const RULES: [RegExp, SignalType][] = [
  [/merger|merges|acquir|acquisition|combines with|joins .*(firm|practice)/i, "ma"],
  [/retire|succession|successor|steps down|managing partner transition/i, "succession"],
  [/peer review|licensure|state board|corrective action|inspection/i, "compliance"],
  [/new office|opens office|expands into|expansion/i, "expansion"],
  [/hires|hired|appoints|named .*(cfo|cio|cto|director|controller|partner)/i, "hire"],
  [/revenue|growth target|fiscal year|headcount/i, "filing"],
  [/attrition|turnover|departures|layoff/i, "turnover"],
  [/digital transformation|rfp|modernization|modernisation/i, "techstack"],
  [/lost .*client|wins .*client|client win/i, "winloss"],
];

export function classifyText(text: string): SignalType {
  for (const [re, type] of RULES) if (re.test(text)) return type;
  return "news";
}
