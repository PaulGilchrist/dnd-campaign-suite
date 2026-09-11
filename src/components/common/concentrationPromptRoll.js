import utils from '../../services/ui/utils.js';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { getAbilitySaveBonus } from '../../services/combat/conditions/conditionUtils.js';
import { hasSaveModifier } from '../../services/combat/conditions/conditionEffects.js';
import { getHolyAuraSaveAdvantage } from './savePromptUtils.js';

function findCharacter(characters, name) {
  return (characters || []).find(c => {
    const cName = typeof c === 'string' ? c : c.name;
    return cName && utils.getName(cName) === utils.getName(name);
  });
}

function getConcentrationAdvantage(current, characters, campaignName) {
  let saveBonus = 0;
  let saveModifiers = null;
  try {
    const character = findCharacter(characters, current.targetName);
    if (character && typeof character !== 'string') {
      saveBonus = getAbilitySaveBonus(character.computedStats || character, 'con');
      saveModifiers = character.saveModifiers || character.computedStats?.saveModifiers;
    }
  } catch { /* ignore */ }

  const holyAuraAdvantage = getHolyAuraSaveAdvantage(current, campaignName);
  const hasAdvantage = holyAuraAdvantage ||
    hasSaveModifier(saveModifiers, 'concentration_saving_throws', 'CON') ||
    (saveModifiers && saveModifiers.some(mod =>
      mod.target === 'saving_throw' &&
      mod.condition === 'concentration_spell_damage' &&
      mod.effect === 'advantage' &&
      mod.abilities && mod.abilities.includes('Constitution')
    ));

  const advantageSources = [];
  if (hasAdvantage && saveModifiers) {
    saveModifiers.forEach(mod => {
      if (mod.source && ((mod.target === 'concentration_saving_throws') || (mod.target === 'saving_throw' && mod.condition === 'concentration_spell_damage' && mod.effect === 'advantage' && mod.abilities && mod.abilities.includes('Constitution')))) {
        if (!advantageSources.includes(mod.source)) {
          advantageSources.push(mod.source);
        }
      }
    });
  }
  if (holyAuraAdvantage && !advantageSources.includes('Holy Aura')) {
    advantageSources.push('Holy Aura');
  }
  return { saveBonus, saveModifiers, hasAdvantage: !!hasAdvantage, advantageSources };
}

function hasConcentrationDisadvantage(current, characters) {
  if (!current.attackerName) return false;
  const attacker = findCharacter(characters, current.attackerName);
  const attackerModifiers = attacker?.saveModifiers || attacker?.computedStats?.saveModifiers;
  return attackerModifiers?.some(mod =>
    mod.condition === 'concentration_breaker' && mod.effect === 'disadvantage'
  ) ?? false;
}

function hasStarryFormBuff(current, characters, saveModifiers) {
  if ((saveModifiers || []).length === 0) return false;
  const character = findCharacter(characters, current.targetName);
  const buffs = character?.activeBuffs || character?.computedStats?.activeBuffs || [];
  return buffs.some(b => b.name === 'Starry Form' && b.constellation === 'Dragon');
}

export function resolveConcentrationRoll({ current, characters, campaignName, auraBonus, auraSourceName }) {
  const { saveBonus, saveModifiers, hasAdvantage, advantageSources } = getConcentrationAdvantage(current, characters, campaignName);
  const hasDisadvantage = hasConcentrationDisadvantage(current, characters);
  const starryFormBuff = hasStarryFormBuff(current, characters, saveModifiers);

  let roll;
  const rawRolls = [rollD20()];
  if (hasAdvantage && hasDisadvantage) {
    roll = rawRolls[0];
  } else if (hasAdvantage) {
    rawRolls.push(rollD20());
    roll = Math.max(rawRolls[0], rawRolls[1]);
  } else if (hasDisadvantage) {
    rawRolls.push(rollD20());
    roll = Math.min(rawRolls[0], rawRolls[1]);
  } else {
    roll = rawRolls[0];
  }
  if (starryFormBuff && roll <= 9) {
    roll = 10;
  }
  const total = roll + saveBonus + auraBonus;
  const success = total >= current.dc;
  const bonusDetail = auraBonus > 0 ? `(+${auraBonus} aura${auraSourceName ? ' from ' + auraSourceName : ''})` : undefined;
  const mode = (hasAdvantage || hasDisadvantage) ? (hasAdvantage ? 'advantage' : 'disadvantage') : 'normal';

  return { saveBonus, roll, rawRolls, total, success, bonusDetail, mode, advantageSources };
}
