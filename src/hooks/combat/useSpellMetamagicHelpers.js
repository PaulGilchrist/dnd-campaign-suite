import { getCombatSummary } from '../../services/encounters/combatData.js';
import { isCreaturePresent } from '../../services/combat/creaturePresence.js';

export function getCreatureTargets(excludeName, campaignName, characters = []) {
  const cs = getCombatSummary(campaignName);
  if (cs?.creatures) {
    // Split-party law: away PCs hold no slot and are not valid targets.
    return cs.creatures.filter(isCreaturePresent).map(c => c.name);
  }
  return characters.map(c => c.name);
}
