// @maintained-by-ai
/**
 * The AI entity NAME LAW, SHARED across layers (bug-designer-draft-accepts-
 * kind-word-entity-name): a drafted row named after its kind ("npc") or after
 * a placeholder sailed through the schema-only validator and Approve made it
 * LIVE campaign data. A law the lane cannot enforce is not a law — so the
 * vocabulary the designer prompts advertise (namingRule() in
 * server/services/ai/authoring/designerPrompts.js) is checked here.
 *
 * SERVER (authoring/entitySchemas.js validateEntity): every authored row —
 * whole-set blueprint, per-entity resume, and refine — fails validation with
 * a model-actionable error, so the existing repair turn quotes it.
 * CLIENT (campaign/draftActions.js approveDraft): belt-and-braces refusal for
 * legacy drafts already on disk when the validator grew the check.
 *
 * Pure ESM, import-free, so the plain-Node server can import it directly
 * (same seam as proposedNoChange.js / dressCapabilities.js).
 */

/** Placeholder names the prompt bans verbatim ("New <kind>" is derived). */
export const NAME_PLACEHOLDERS = ['placeholder', 'example', 'test', 'TBD', 'Untitled'];

/** Authorable entity kinds (mirrors entitySchemas.js ENTITY_KINDS). */
export const NAME_LAW_KIND_WORDS = [
  'faction', 'npc', 'settlement', 'quest', 'encounter', 'session', 'mapPlan',
];

// Lower-case and drop every non-alphanumeric so the shape-leak spellings the
// prompts worry about compare equal: "map_plan"/"Map Plan"/"mapplan" all
// flatten to "mapplan". EXACT flatten-equality (never substring) so genuine
// names that merely contain a forbidden word ("Testament", "Testing Grounds")
// cannot false-positive.
const flatten = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const KIND_FLATS = new Set();
for (const kind of NAME_LAW_KIND_WORDS) {
  const flat = flatten(kind);
  KIND_FLATS.add(flat);
  KIND_FLATS.add(`${flat}s`); // the list-key leak: name "npcs" for an npc
}
const PLACEHOLDER_FLATS = new Set([
  ...NAME_PLACEHOLDERS.map(flatten),
  ...NAME_LAW_KIND_WORDS.map(kind => `new${flatten(kind)}`), // "New npc"
]);

/**
 * Returns a plain-English, model-actionable violation phrase (the shape the
 * repair turns and the Campaign Builder error banner want), or null when the
 * name obeys the law. Non-string/blank names return null — absence and type
 * are the JSON-Schema validator's job (validateEntity), so this never
 * duplicates that error.
 */
export function nameLawViolation(kind, name, field = 'name') {
  const value = typeof name === 'string' ? name.trim() : '';
  if (!value) return null;
  const flat = flatten(value);
  if (KIND_FLATS.has(flat)) {
    return `${field} "${value}" is a kind word — give the ${kind} a proper, unique in-world name, never its kind word or a placeholder`;
  }
  if (PLACEHOLDER_FLATS.has(flat)) {
    return `${field} "${value}" is a placeholder — give the ${kind} a proper, unique in-world name, never its kind word or a placeholder`;
  }
  return null;
}
