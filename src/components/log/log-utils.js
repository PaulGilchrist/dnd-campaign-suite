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

// ── AI audit one-line summaries (backlog ai-audit-log-rows-raw-json) ──
// ai_designer/ai_refine/ai_world audit rows carry structured payload fields
// (stage/kind/instruction/created/errors…) and no message/description, so the
// generic fallback dumped raw JSON. These helpers collapse the plausible
// producer shapes into one human-readable line: kind + instruction + outcome.

function truncateLine(text, max = 260) {
  const s = String(text).replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

// Only render scalars as text — objects/arrays never reach "[object Object]".
function asText(value) {
  return (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    ? String(value)
    : null;
}

function attemptsPhrase(attempts) {
  const n = Number(attempts);
  if (n > 1) return `after ${n} attempts`;
  if (n === 1) return 'after 1 attempt';
  return 'gave up after retries';
}

// { npc: 1, mapPlan: 2 } → "npc 1, mapPlan 2" (scalar values only; empty → null).
function summarizeCounts(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const parts = Object.entries(obj)
    .map(([key, value]) => {
      const text = asText(value);
      return text === null ? null : `${key} ${text}`;
    })
    .filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

// entityPlan rows [{kind, count}] → "npc 1, encounter 1, mapPlan 1".
function summarizeEntityPlan(plan) {
  if (!Array.isArray(plan)) return null;
  const parts = plan.map(item => {
    if (item && typeof item === 'object' && item.kind) {
      const count = asText(item.count);
      return count ? `${item.kind} ${count}` : String(item.kind);
    }
    return asText(item);
  }).filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

// error (string) or errors (array) → joined message ('' when absent).
function errorText(error, errors) {
  const value = error ?? errors;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(item => asText(item) ?? '').filter(Boolean).join('; ');
  }
  return '';
}

function describeDesigner(entry) {
  const stage = asText(entry.stage) || 'run';
  const head = `Designer ${stage}${entry.fallback ? ` (fallback ${entry.fallback})` : ''}`;
  const failure = errorText(entry.error, entry.errors);
  if (failure) return `${head} stopped — ${failure} (${attemptsPhrase(entry.attempts)})`;
  const parts = [head];
  const plan = summarizeEntityPlan(entry.entityPlan);
  if (plan) parts.push(`plan ${plan}`);
  const created = summarizeCounts(entry.created);
  if (created) parts.push(`created ${created}`);
  else if ('created' in entry) parts.push('created nothing');
  if (entry.snapshot) parts.push(`restore point ${entry.snapshot}`);
  parts.push(attemptsPhrase(entry.attempts));
  return parts.join(' — ');
}

function describeRefine(entry) {
  const kind = asText(entry.kind) || 'entity';
  const instruction = entry.instruction ? `“${truncateLine(entry.instruction, 140)}”` : '';
  const outcome = Number(entry.attempts) > 0
    ? `proposed a replacement ${attemptsPhrase(entry.attempts)}`
    : 'refused — the proposed JSON failed validation';
  return `Refine ${kind}${instruction ? ` ${instruction} — ` : ' — '}${outcome}`;
}

function describeWorld(entry) {
  const proposal = (entry.proposal && typeof entry.proposal === 'object') ? entry.proposal : {};
  const kind = asText(proposal.kind) || asText(entry.kind) || 'proposal';
  const body = asText(proposal.text) || asText(proposal.name) || '';
  const needsHuman = kind === 'needs_human';
  return `World keeper proposed ${kind}${body ? ` — “${truncateLine(body, 180)}”` : ''}${needsHuman ? ' (the GM supplies this)' : ''}`;
}

const AI_AUDIT_DESCRIBERS = {
  ai_designer: describeDesigner,
  ai_refine: describeRefine,
  ai_world: describeWorld
};

// Keys that never belong in the readable line (chrome, or handled explicitly).
const AUDIT_SUMMARY_SKIP = new Set([
  'id', 'type', 'name', 'timestamp', 'characterName',
  'message', 'description', 'noteText', 'summary'
]);

// Last-resort readable line for unrecognised AI audit shapes: key: value for
// scalars, item counts for arrays, key names for objects — never full JSON.
function summarizeResidualPayload(entry) {
  const parts = [];
  for (const [key, value] of Object.entries(entry)) {
    if (AUDIT_SUMMARY_SKIP.has(key) || value === null || value === undefined) continue;
    const scalar = asText(value);
    if (scalar !== null) {
      parts.push(`${key} ${scalar}`);
    } else if (Array.isArray(value)) {
      parts.push(`${key} ${value.length} item${value.length === 1 ? '' : 's'}`);
    } else if (typeof value === 'object') {
      const counts = summarizeCounts(value);
      parts.push(`${key} ${counts || Object.keys(value).join('/')}`);
    }
  }
  return parts.length ? parts.join(' · ') : 'No detail recorded';
}

export function formatAiAuditLine(entry) {
  const direct = asText(entry.message) ?? asText(entry.description)
    ?? asText(entry.noteText) ?? asText(entry.summary);
  if (direct && direct.trim()) return truncateLine(direct, 400);
  const describe = AI_AUDIT_DESCRIBERS[entry.type];
  if (describe) return truncateLine(describe(entry), 400);
  return truncateLine(summarizeResidualPayload(entry), 400);
}
