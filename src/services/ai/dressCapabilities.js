// @maintained-by-ai
/**
 * AI Dress capability vocabulary (backlog 2026-11-12 WY ai-dress-hides-vocabulary).
 *
 * The dress op set is ITEM-class only: liveDressPlanSchema (server/services/
 * ai/authoring/entitySchemas.js) admits targets `item`, `poi` and `token`, and
 * validateLiveDressPlan rejects structural targets (`wall`, …) fail-closed
 * (pinned entitySchemas.test.js:164). A GM asking to "enclose the room with
 * walls" therefore honestly receives a furniture-only proposal — with zero
 * explanation. This file supplies the two small pure predicates the modal
 * needs: the structure-implied heuristic and the honest sentinel that pairs
 * with it (same vocabulary as the refine lane's NO_CHANGE_NOTICE sibling).
 *
 * The keyword list deliberately EXCLUDES ambiguous prop nouns the dress lane
 * CAN serve: "door" is an advertised item type (dressMap.js system prompt:
 * "chest, trap, torch, door…"), and "room"/"window" name landmarks and props
 * too ("throne room" is the modal's own placeholder) — matching those would
 * false-positive the sentinel on legitimate item asks.
 */

/** Structural-change vocabulary: walls/enclosures/architecture, not props. */
const STRUCTURE_TERMS = /\b(?:walls?|doorways?|enclos(?:e|es|ed|ing|ure)|barricad(?:e|es|ing)?|partitions?|barriers?|fences?|staircases?|stairs|ceilings?|corridors?|hallways?|structur\w*)\b/i;

/** The op targets liveDressPlanSchema validates — anything else is structural. */
const ITEM_CLASS_TARGETS = new Set(['item', 'poi', 'token']);

/** Sentinel shown when a structure-implied ask yielded an items-only proposal. */
export const STRUCTURE_SENTINEL =
  'The model proposed no structural changes (dress supports items only).';

/** True when the free-text instruction asks for walls/structural work. */
export function instructionImpliesStructure(text) {
  return typeof text === 'string' && STRUCTURE_TERMS.test(text);
}

/**
 * True when any proposed op addresses a structural target. The validated plan
 * never contains one (the schema refuses them) — this stays honest if the op
 * vocabulary ever grows, and it is the second half of the sentinel gate.
 */
export function proposalIncludesStructuralOps(ops) {
  return (ops || []).some((op) => op && !ITEM_CLASS_TARGETS.has(op.target));
}

/**
 * The honest preview-stage sentinel: fires ONLY when the instruction implied
 * structural work AND the proposal genuinely contains none. Item-only asks
 * ("add a table at 10,10 and two chairs") never see it.
 * @returns {string|null} sentinel copy, or null for no notice.
 */
export function dressStructureNotice(instruction, proposal) {
  if (!proposal || !instructionImpliesStructure(instruction)) return null;
  return proposalIncludesStructuralOps(proposal.ops) ? null : STRUCTURE_SENTINEL;
}
