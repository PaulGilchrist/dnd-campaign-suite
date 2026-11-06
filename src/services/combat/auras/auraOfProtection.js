import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getAllyList, hasExplicitAllyList } from '../../../hooks/useAllySelection.js';
import { loadMapData } from '../../maps/mapsService.js';

export const CANNOT_ACT_CONDITIONS = ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious'];
export const DEFAULT_AURA_RANGE_FT = 10;
export const EXPANDED_AURA_RANGE_FT = 30;

export function hasAura(playerStats, auraName) {
  return playerStats?.automation?.passives?.some(p => p.name === auraName) ?? false;
}

export function hasAuraOfProtection(playerStats) {
  return hasAura(playerStats, 'Aura of Protection');
}

export function getAuraRangeFromStats(playerStats) {
  if (hasAura(playerStats, 'Aura Expansion')) return EXPANDED_AURA_RANGE_FT;
  return DEFAULT_AURA_RANGE_FT;
}

export function getChaModifier(playerStats) {
  const cha = playerStats.abilities?.find(a => a.name === 'Charisma');
  if (cha?.bonus != null) return cha.bonus;
  if (cha) return Math.floor((cha.baseScore + cha.featIncrease + cha.miscIncrease - 10) / 2);
  return 0;
}

export function hasCannotActCondition(sourceName, _campaignName) {
  try {
    const conditions = getRuntimeValue(sourceName, 'activeConditions');
    if (!Array.isArray(conditions)) return false;
    return conditions.some(c => CANNOT_ACT_CONDITIONS.includes(c));
  } catch {
    return false;
  }
}

// Target-side betrayal gate (mirrors wolfAuraUtils.js:24-27 and the OA gate in
// opportunityTrigger.js:47-48): a bearer with an EDITED ally list (post-🤝-editor,
// owner ruling 2026-11-03) only pads saves for creatures on that list — the
// editor can NARROW the aura (defectors), never be a prerequisite for it.
// An UNEDITED bearer keeps the pre-editor legacy party-by-type default
// (useAllySelection.js:24-27 doctrine): party tokens are allies, NPC/monster
// tokens are enemies. RAW: "you and friendly creatures within 10 feet of you"
// — the bearer always covers itself.
function bearerCoversTarget(bearerName, targetName, partyNames) {
  if (hasExplicitAllyList(bearerName)) return getAllyList(bearerName).includes(targetName);
  return partyNames.has(targetName) || targetName === bearerName;
}

// Display-honesty probe (backlog 2026-11-06): when an active map exists but the
// winning bearer has NO token on it AND is not a combat-board member, the
// aura's co-presence is merely ASSUMED by the gridless-lenient doctrine
// ("phantom bearer" — computeAuraBonus iterates the whole roster, isWithinRange
// consults-and-passes for unplaced creatures). This NEVER gates the bonus —
// it only flags the assumption so the save-prompt breakdown can caveat it.
// Token lookup mirrors the established map lanes (coronaAuraUtils.findMapToken):
// players/placedItems entries matched by exact name.
export async function isBearerAssumedCoPresent(bearerName, { campaignName, activeMapName, allCreatures }) {
  if (!bearerName) return false;
  const mapName = activeMapName || getRuntimeValue('__map__', 'activeMapName');
  if (!mapName) return false; // gridless campaign — co-presence is the norm, nothing to caveat
  if ((allCreatures || []).some(c => c?.name === bearerName)) return false; // combat-board member
  try {
    const data = await loadMapData(campaignName || getRuntimeValue('__campaign__', 'campaignName'), mapName);
    if (!data) return false; // unresolvable map document — cannot assert absence (fail-open)
    const tokens = [...(data.players || []), ...(data.placedItems || [])];
    return !tokens.some(t => t?.name === bearerName);
  } catch {
    return false; // map unreadable — never claim a caveat we could not verify
  }
}

export async function computeAuraBonus({ targetName, characters, campaignName, activeMapName, allCreatures }) {
  let bestBonus = 0;
  let bestSource = null;

  // Legacy ally set for the unedited-bearer split: combat-summary entries
  // flagged type 'player' are the party tokens (great-split doctrine —
  // NPC/monster combatants are type 'npc' and enemies until edited otherwise).
  const partyNames = new Set((allCreatures || []).filter(c => c?.type === 'player').map(c => c?.name));

  for (const entry of characters) {
    const name = entry.name;
    const stats = entry.computedStats;
    if (!name) continue;
    if (!stats || !hasAuraOfProtection(stats)) continue;
    if (hasCannotActCondition(name)) continue;
    if (!bearerCoversTarget(name, targetName, partyNames)) continue;
    const chaMod = getChaModifier(stats);
    const bonus = Math.max(1, chaMod);
    const range = getAuraRangeFromStats(stats);
    const inRange = await isWithinRange(name, targetName, range);
    if (!inRange) continue;
    if (bonus > bestBonus) {
      bestBonus = bonus;
      bestSource = name;
    }
  }

  if (!bestSource) return { bonus: bestBonus, sourceName: bestSource };
  const result = { bonus: bestBonus, sourceName: bestSource };
  // Carried ONLY when the co-presence is assumed (all other lanes keep the
  // historical { bonus, sourceName } shape); consumed by the SavePromptModal
  // pre-roll aura breakdown tooltip. Bonus math is untouched.
  if (await isBearerAssumedCoPresent(bestSource, { campaignName, activeMapName, allCreatures })) {
    result.assumedCoPresent = true;
  }
  return result;
}
