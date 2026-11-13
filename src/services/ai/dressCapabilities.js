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
 *
 * WALL-AS-ITEM LAW (bug-ai-dress-wall-as-item-sentinel-contradiction): the
 * schema whitelists TARGETS, not item nouns — a model can smuggle a wall ask
 * through as `target:'item', item:{type:'wall'}`. Since the liveDressPlanSchema
 * only constrains `target`, BOTH seams now read the item nouns: the sentinel
 * gate below scans them (the notice can never claim "no structural changes"
 * beside `add wall at x,y` preview lines), and the server applier refuses
 * wall-named add types fail-closed via structuralItemType().
 */
import { itemSpriteHref } from '../maps/itemSprites.js';

// Structural-change vocabulary: walls/enclosures/architecture, not props.
// Boundaries are spelled `(?<![A-Za-z0-9])…(?![A-Za-z0-9])` instead of `\b`
// because `\b` counts "_" as a WORD char — the live model re-smuggled walls
// as `type:'stone_wall'` and a \b-based scan read it as one identifier with
// no "wall" inside it. (CamelCase stays safe the same way: 'arrowSlitWall'
// has a real sprite and its "Wall" is letter-joined → never matches.)
const STRUCTURE_TERMS = /(?<![A-Za-z0-9])(?:walls?|doorways?|enclos(?:e|es|ed|ing|ure)|barricad(?:e|es|ing)?|partitions?|barriers?|fences?|staircases?|stairs|ceilings?|corridors?|hallways?|structur\w*)(?![A-Za-z0-9])/i;

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
 * True when any proposed op addresses a structural target OR dresses a prop
 * NAMED like a structural layer (`target:'item', item:{type:'wall'}` — the
 * smuggled face the live model produced). The preview list renders item.type
 * verbatim (`add wall at 4,5`), so the sentinel gate reads the same words:
 * a proposal listing wall-ish rows never pairs with "no structural changes".
 * Only item nouns are scanned — a landmark POI called "Ruined Gateway" is a
 * label, not a preview row that reads like architecture.
 */
export function proposalIncludesStructuralOps(ops) {
  return (ops || []).some((op) => Boolean(op) && (
    !ITEM_CLASS_TARGETS.has(op.target)
    || STRUCTURE_TERMS.test(String(op.item?.type ?? ''))
    || STRUCTURE_TERMS.test(String(op.item?.name ?? ''))
  ));
}

/**
 * Server-side refusal predicate (dressMap.js `addPlacedItem`): a proposed
 * item TYPE that names a structural layer the op set cannot build. Rows like
 * `type:'wall'` land as generic "?" placeholders — they promise masonry and
 * deliver a dashed box beside the untouched-but-empty `walls[]` lane. Types
 * the map actually RENDERS are legitimate dressing even when their noun reads
 * structural ('stairs', 'door', 'secretDoor', 'arrowSlitWall' all have real
 * sprites in itemSprites.js) — those stay allowed.
 */
export function structuralItemType(type) {
  if (typeof type !== 'string' || !type.trim()) return false;
  return STRUCTURE_TERMS.test(type) && itemSpriteHref(type) === null;
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
