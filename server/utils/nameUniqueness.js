/**
 * Shared duplicate-name validation for name-keyed entity lists
 * (mirrors the NPC/Maps case-insensitive duplicate guards).
 */

/**
 * Find a case-insensitive duplicate name within a list of entities.
 * @param {Array} entities
 * @param {string} displayName singular display name, e.g. 'quest'
 * @returns {string|null} error message when two entities share a name, else null
 */
export function findDuplicateNameError(entities, displayName) {
  const seen = new Set();
  for (const entity of entities || []) {
    const name = (entity?.name || '').trim().toLowerCase();
    if (!name) continue;
    if (seen.has(name)) {
      return `A ${displayName} with that name already exists`;
    }
    seen.add(name);
  }
  return null;
}
