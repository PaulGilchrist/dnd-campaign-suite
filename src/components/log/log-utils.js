export function formatTimestamp(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const ROLL_ICON_TYPES = {
  attack: 'fa-crosshairs',
  spell_attack: 'fa-wand-magic-sparkles',
  save: 'fa-shield-halved',
  'condition-save': 'fa-shield-halved',
  'save-ottos-dance': 'fa-shield-halved',
  'save-damage': 'fa-shield-halved',
  'save-banishment': 'fa-shield-halved',
  'save-polymorph': 'fa-paw',
  'save-animal-shapes': 'fa-paw',
  'save-prismatic-spray': 'fa-wand-magic-sparkles',
  'save-prismatic-spray-indigo': 'fa-eye',
  'save-prismatic-spray-violet': 'fa-door-open',
  'save-imprisonment': 'fa-shield-halved',
  'save-confusion': 'fa-shield-halved',
  'save-forcecage': 'fa-shield-halved',
  'save-forcecage-escape': 'fa-shield-halved',
  'save-maze': 'fa-shield-halved',
  'save-maze-escape': 'fa-shield-halved',
  'aoe-damage': 'fa-wand-magic-sparkles',
  initiative: 'fa-bolt',
  damage: 'fa-skull'
};

export function getRollIconType(rollType) {
  return ROLL_ICON_TYPES[rollType] || 'fa-dice-d20';
}

// ── Client-side filtering + render windowing (display-only, never persisted) ──

// Number of matching entries rendered per window; "Load older" extends by this amount.
export const LOG_WINDOW_SIZE = 100;

// Recursively collects all string values of an entry (skipping ids) so text
// search matches the entry's content regardless of which per-type field holds it.
function collectSearchableStrings(value, parts) {
  if (typeof value === 'string') {
    parts.push(value);
  } else if (Array.isArray(value)) {
    value.forEach(item => collectSearchableStrings(item, parts));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => {
      if (key === 'id') return;
      collectSearchableStrings(item, parts);
    });
  }
}

export function getEntrySearchText(entry) {
  const parts = [];
  collectSearchableStrings(entry, parts);
  return parts.join(' ').toLowerCase();
}

// AND-semantics facets over the already-fetched log array:
// { text, type, character, rollType } — empty string means "no constraint" for
// that facet. rollType only constrains type:'roll' entries (rollType-less rolls
// pass only under "All roll types"); all other entry types pass regardless.
export function filterLogEntries(entries, { text = '', type = '', character = '', rollType = '' } = {}) {
  const needle = text.trim().toLowerCase();
  return entries.filter(entry => {
    if (type && entry.type !== type) return false;
    if (character && entry.characterName !== character) return false;
    if (rollType && entry.type === 'roll' && entry.rollType !== rollType) return false;
    if (needle && !getEntrySearchText(entry).includes(needle)) return false;
    return true;
  });
}

// Distinct rollType values actually present on type:'roll' entries, sorted —
// derived from data (dynamic values like `save-<spell-slug>` exist), never a
// hardcoded list. Used for the Roll type sub-facet options.
export function getRollTypeOptions(entries) {
  return [...new Set(
    entries.filter(entry => entry.type === 'roll' && entry.rollType).map(entry => entry.rollType)
  )].sort();
}

// Whole-word initialisms corrected by formatEntryTypeLabel.
const LABEL_INITIALISMS = { gm: 'GM', ai: 'AI' };

// Shared log type/rollType → display label (generic rows + filter facets).
// Splits hyphen/underscore-bearing types into words with per-word
// capitalization, correcting known initialisms:
// 'gm-note' -> 'GM Note', 'ai_designer' -> 'AI Designer',
// 'death_save' -> 'Death Save', 'note' -> 'Note'
export function formatEntryTypeLabel(type) {
  return String(type)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(word => LABEL_INITIALISMS[word.toLowerCase()]
      || word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
