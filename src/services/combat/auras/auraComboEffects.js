import { hasAuraOfProtection, hasCannotActCondition, getAuraRangeFromStats } from './auraOfProtection.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getAllyList } from '../../../hooks/useAllySelection.js';

function applyAlacrity(passive, acc, name) {
  if (passive.effect !== 'speed_bonus') return;
  const bonus = passive.bonusExpression ? parseInt(passive.bonusExpression, 10) : 10;
  if (bonus > acc.speedBonus) {
    acc.speedBonus = bonus;
    acc.speedSource = name;
  }
}

function applyConditionImmunity(passive, acc, condition, name) {
  if (passive.conditionImmunity !== condition) return;
  acc.immunities.add(condition);
  acc.immunitySources[condition] = name;
}

function applyWarding(passive, acc, name) {
  if (!passive.resistances?.length) return;
  passive.resistances.forEach(r => acc.resistances.add(r));
  acc.resistanceSource = name;
}

const PASSIVE_APPLIERS = {
  'Aura of Alacrity': applyAlacrity,
  'Aura of Courage': (passive, acc, name) => applyConditionImmunity(passive, acc, 'frightened', name),
  'Aura of Devotion': (passive, acc, name) => applyConditionImmunity(passive, acc, 'charmed', name),
  'Aura of Warding': applyWarding,
};

async function isAuraContributing({ name, stats, targetName }) {
  if (!name) return false;
  if (!stats || !hasAuraOfProtection(stats)) return false;
  if (hasCannotActCondition(name)) return false;
  const allies = getAllyList(name);
  if (targetName !== name && !allies.includes(targetName)) return false;
  const range = getAuraRangeFromStats(stats);
  return await isWithinRange(name, targetName, range);
}

export async function computeAuraComboEffects({ targetName, characters }) {
  const acc = {
    speedBonus: 0,
    speedSource: null,
    immunities: new Set(),
    immunitySources: {},
    resistances: new Set(),
    resistanceSource: null,
  };

  for (const entry of characters) {
    const name = entry.name;
    if (!await isAuraContributing({ name, stats: entry.computedStats, targetName })) continue;

    const passives = entry.computedStats.automation?.passives || [];
    for (const passive of passives) {
      if (!Object.hasOwn(PASSIVE_APPLIERS, passive.name)) continue;
      PASSIVE_APPLIERS[passive.name](passive, acc, name);
    }
  }

  return {
    speedBonus: acc.speedBonus,
    speedSource: acc.speedSource,
    immunities: [...acc.immunities],
    immunitySources: acc.immunitySources,
    resistances: [...acc.resistances],
    resistanceSource: acc.resistanceSource,
  };
}
