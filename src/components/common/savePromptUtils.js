import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getAllyList } from '../../hooks/useAllySelection.js';
import utils from '../../services/ui/utils.js';

export function getSaveDisadvantage(current, campaignName) {
  if (!current) return false;
  if (current.disadvantage) return true;
  const saveType = (current.saveType || '').toLowerCase();
  if (saveType !== 'dex') return false;
  const targetConditions = getRuntimeValue(current.targetName, 'activeConditions', campaignName) || [];
  if (targetConditions.some(c => String(c).toLowerCase() === 'charmed')) return true;
  const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
  if (targetEffects.some(te => te.target === current.targetName && te.effect === 'ottos_irresistible_dance')) return true;
  // SP-109: Slow imposes disadvantage on DEX saves (house model of the RAW -2 penalty).
  if (targetConditions.some(c => String(c).toLowerCase() === 'slow')) return true;
  return targetEffects.some(te => te.target === current.targetName && te.effect === 'dex_save_disadvantage');
}

// Holy Aura: protected targets (holy_aura targetEffect) gain advantage on ALL saving throws.
export function getHolyAuraSaveAdvantage(current, campaignName) {
  if (!current?.targetName) return false;
  const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
  return targetEffects.some(te => te.target === current.targetName && te.effect === 'holy_aura');
}

function nimbusCoversTarget(grantorName, targetName, campaignName) {
  if (!getRuntimeValue(grantorName, 'holyNimbusActive', campaignName)) return false;
  const allyList = getAllyList(grantorName);
  return allyList.includes(targetName) || allyList.length === 1;
}

// Source-restricted save advantage (e.g. Holy Nimbus: advantage against Fiends/Undead for allies)
export function getHolyNimbusSaveAdvantage(current, characters, campaignName) {
  if (!current?.attackerName) return false;
  const targetName = current.targetName;
  const combatSummary = getCombatSummary(campaignName);
  const creatures = combatSummary?.creatures || [];
  const attackerCreature = creatures.find(c => utils.getName(c.name) === utils.getName(current.attackerName));
  if (!attackerCreature) return false;
  const attackerType = (attackerCreature.monsterType || '').toLowerCase();
  if (attackerType !== 'fiend' && attackerType !== 'undead') return false;
  for (const character of (characters || [])) {
    if (nimbusCoversTarget(character.name, targetName, campaignName)) return true;
  }
  // Also check NPCs with Holy Nimbus
  for (const creature of creatures) {
    if (creature.type === 'player') continue;
    if (nimbusCoversTarget(utils.getName(creature.name), targetName, campaignName)) return true;
  }
  return false;
}
