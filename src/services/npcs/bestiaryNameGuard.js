// @maintained-by-ai
/**
 * CLIENT mirror of the server NPC name guard (server/routes/npcs.js
 * `isBestiaryMonsterName` + `bestiaryNameError`): npcs.json is reserved for
 * CUSTOM NPCs — pre-made monsters join through the Encounter Builder with
 * their real stat block. The server 400s a bestiary-name save and the modal
 * renders that copy inline; this gate moves the SAME law client-side (like
 * the dup-quest block in Quests.jsx) so Save disables live while the GM
 * types and no doomed PUT round-trip is ever paid.
 *
 * Semantics mirror the server guard EXACTLY: names are compared
 * `String(name || '').trim().toLowerCase()` against the bestiary set built
 * from monsters.json with `String(m?.name || '').toLowerCase()`.
 *
 * Fail-open by design: while the name-set is still loading, or if the fetch
 * fails, the gate is inert (null set → never matches) and the server 400
 * remains the authoritative backstop with its verbatim inline refusal.
 *
 * The server keeps its own fs-loaded copy of the predicate (it cannot import
 * this module's fetch lane, and this module cannot import the server route);
 * the normalization and error copy above are the shared contract — change
 * both lanes together.
 */
import { loadMonsters } from '../ui/dataLoader.js';

/** Module-level memo: the /data/monsters.json name-set is fetched ONCE
 *  (loadMonsters itself caches; this memo also dedups the Set build) and
 *  shared across every mount. */
let nameSetPromise = null;

function buildNameSet(monstersData) {
  const list = Array.isArray(monstersData) ? monstersData : (monstersData?.monsters || []);
  return new Set(list.map(m => String(m?.name || '').toLowerCase()).filter(Boolean));
}

/**
 * Resolves to the lower-cased bestiary name Set, or null when the data
 * could not be loaded (gate inert — server enforcement backstops).
 * Never rejects.
 */
export function loadBestiaryMonsterNames() {
  if (!nameSetPromise) {
    nameSetPromise = Promise.resolve()
      .then(() => loadMonsters())
      .then(buildNameSet)
      .catch(() => null);
  }
  return nameSetPromise;
}

/**
 * Server-guard mirror: true only when the loaded name-set proves the name
 * matches a published monster. `nameSet` null/undefined (still loading or
 * failed load) → false, so Save is never permanently disabled by this gate.
 */
export function isBestiaryMonsterName(name, nameSet) {
  if (!nameSet) return false;
  return nameSet.has(String(name || '').trim().toLowerCase());
}

/** Byte-identical to the server `bestiaryNameError()` copy — the inline hint
 *  and the server's 400 refusal must never disagree on vocabulary. */
export function bestiaryNameError(name) {
  const trimmed = String(name || '').trim();
  return `"${trimmed}" is a published monster — monsters join through the Encounter Builder with their real stat block. NPCs are for custom characters with their own name.`;
}
