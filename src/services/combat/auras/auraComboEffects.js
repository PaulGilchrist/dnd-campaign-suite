import { hasAuraOfProtection, hasCannotActCondition, getAuraRangeFromStats } from './auraOfProtection.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getAllyList } from '../../../hooks/useAllySelection.js';

export async function computeAuraComboEffects({ targetName, characters }) {
  let speedBonus = 0;
  let speedSource = null;
  const immunities = new Set();
  const immunitySources = {};
  const resistances = new Set();
  let resistanceSource = null;

  for (const entry of characters) {
    const name = entry.name;
    const stats = entry.computedStats;
    if (!name) continue;
    if (!stats || !hasAuraOfProtection(stats)) continue;
    if (hasCannotActCondition(name)) continue;
    const allies = getAllyList(name);
    if (!allies.includes(targetName)) continue;
    const range = getAuraRangeFromStats(stats);
    const inRange = await isWithinRange(name, targetName, range);
    if (!inRange) continue;

    const passives = stats.automation?.passives || [];

    for (const passive of passives) {
      if (passive.name === 'Aura of Alacrity' && passive.effect === 'speed_bonus') {
        const bonus = passive.bonusExpression ? parseInt(passive.bonusExpression, 10) : 10;
        if (bonus > speedBonus) {
          speedBonus = bonus;
          speedSource = name;
        }
      }

      if (passive.name === 'Aura of Courage' && passive.conditionImmunity === 'frightened') {
        immunities.add('frightened');
        immunitySources.frightened = name;
      }

      if (passive.name === 'Aura of Devotion' && passive.conditionImmunity === 'charmed') {
        immunities.add('charmed');
        immunitySources.charmed = name;
      }

      if (passive.name === 'Aura of Warding' && passive.resistances?.length) {
        passive.resistances.forEach(r => resistances.add(r));
        resistanceSource = name;
      }
    }
  }

  return {
    speedBonus,
    speedSource,
    immunities: [...immunities],
    immunitySources,
    resistances: [...resistances],
    resistanceSource,
  };
}
