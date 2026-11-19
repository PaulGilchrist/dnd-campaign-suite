/**
 * Shared bestiary search/filter/cap helpers (moved VERBATIM out of
 * EncounterBuilder.jsx by the quick-monster-spawn feature, 2026-11-19, so the
 * tracker's "+ Monster" picker rides the exact same narrowing lane as the
 * Encounter Builder instead of forking a second search). Behaviour is byte-
 * identical to the EB original; EncounterBuilder.jsx imports these back and
 * its tests keep driving them through the real builder.
 *
 * Bounded bestiary render (EN backlog 2026-11-08): the full bestiary (~640
 * rows in monsters.json) must never all render behind the search box — heavy
 * first paint + slow DOM queries. With NO narrowing control active (empty
 * search, no environment/type/size/CR filter) only the first BESTIARY_RENDER_CAP
 * rows mount, with a visible "type to narrow" affordance — mirroring the
 * capped-list pattern of useEquipmentSearch (slice(0, 20)). Typing renders the
 * full match set; selected rows are always kept so their checkboxes and qty
 * controls stay reachable.
 */

export const BESTIARY_RENDER_CAP = 50;

function crToNumber(cr) {
  if (cr === null || cr === undefined || cr === '' || cr === 'None') return NaN;
  const str = String(cr).trim().toLowerCase();
  if (str === 'any') return 999;
  const match = str.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (match) return parseInt(match[1], 10) / parseInt(match[2], 10);
  const num = parseFloat(str);
  return isNaN(num) ? NaN : num;
}

function matchesCrRange(m, crMinNum, crMaxNum) {
  if (crMinNum === null && crMaxNum === null) return true;
  const cr = crToNumber(m.challenge_rating);
  if (isNaN(cr)) return false;
  if (crMinNum !== null && cr < crMinNum) return false;
  if (crMaxNum !== null && cr > crMaxNum) return false;
  return true;
}

function matchesSearchQuery(m, q) {
  return m.name.toLowerCase().includes(q)
     || (m.type && m.type.toLowerCase().includes(q))
     || (m.subtype && m.subtype.toLowerCase().includes(q));
}

const monsterSortExtractors = {
  name: (m) => m.name.toLowerCase(),
  cr: (m) => m.challenge_rating || 0,
  xp: (m) => m.xp || 0,
  env: (m) => (m.environments || []).join(', ').toLowerCase(),
};

function getMonsterSortValue(m, sortField, selectedMonsters) {
  if (sortField === 'sel') return selectedMonsters.some((sm) => sm.index === m.index) ? 0 : 1;
  return (monsterSortExtractors[sortField] || monsterSortExtractors.name)(m);
}

export function compareMonsters(a, b, sortField, sortDirection, selectedMonsters) {
  const valA = getMonsterSortValue(a, sortField, selectedMonsters);
  const valB = getMonsterSortValue(b, sortField, selectedMonsters);
  if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
  if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
  return 0;
}

export function filterMonsters(monsters, filter = {}) {
  if (!monsters) return [];
  const { searchQuery = '', environmentFilter = '', typeFilter = '', sizeFilter = '', crMin = '', crMax = '' } = filter;
  const crMinNum = !crMin ? null : parseFloat(crMin);
  const crMaxNum = !crMax ? null : parseFloat(crMax);
  const q = searchQuery ? searchQuery.toLowerCase() : '';
  return monsters.filter(m => {
    if (environmentFilter && m.environments && !m.environments.includes(environmentFilter)) return false;
    if (typeFilter && m.type && m.type.toLowerCase() !== typeFilter.toLowerCase()) return false;
    if (sizeFilter && m.size && m.size.toLowerCase() !== sizeFilter.toLowerCase()) return false;
    if (!matchesCrRange(m, crMinNum, crMaxNum)) return false;
    if (!q) return true;
    return matchesSearchQuery(m, q);
  });
}

// True when any search/filter control actively narrows the bestiary — a
// narrowed result set is small by definition, so it renders in full.
export function isBestiaryNarrowed(filter = {}) {
  const hasValue = (v) => v !== '' && v !== null && v !== undefined;
  return Boolean(
    (filter.searchQuery && filter.searchQuery.trim())
    || filter.environment
    || filter.type
    || filter.size
    || hasValue(filter.crMin)
    || hasValue(filter.crMax)
  );
}

// Capped un-narrowed face: first BESTIARY_RENDER_CAP rows in sort order, plus
// every selected row kept visible (so checked boxes/qty controls never hide
// behind the cap). Narrowed or short result sets pass through untouched.
export function capBestiaryRows(sortedMonsters, selectedMonsters, narrowed) {
  if (narrowed || sortedMonsters.length <= BESTIARY_RENDER_CAP) return sortedMonsters;
  const selected = new Set(selectedMonsters.map((m) => m.index));
  const kept = [];
  let budget = BESTIARY_RENDER_CAP;
  for (const m of sortedMonsters) {
    if (selected.has(m.index) || budget > 0) {
      kept.push(m);
      if (!selected.has(m.index)) budget -= 1;
    }
  }
  return kept;
}
