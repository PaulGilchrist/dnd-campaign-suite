import storage from './storage.js';
import { rollD20 } from './diceRoller.js';
import utils from './utils.js';
import { sendDeathSavePrompt, sendConcentrationPrompt } from './savePromptService.js';
import { rollConcentrationSave } from './concentrationRules.js';

export function computeDamageAfterResistances(rawDamage, damageTypes, resistances, immunities) {
  if (!damageTypes || damageTypes.length === 0) return rawDamage;
  for (const dt of damageTypes) {
    const lower = dt.toLowerCase();
    if (immunities?.some(i => i.toLowerCase() === lower)) return 0;
    if (resistances?.some(r => r.toLowerCase() === lower)) return Math.floor(rawDamage / 2);
  }
  return rawDamage;
}

export function computeDamageAfterSave(rawDamage, saveSuccess, dcSuccess) {
  if (!saveSuccess) return rawDamage;
  if (dcSuccess === 'half') return Math.floor(rawDamage / 2);
  return 0;
}

export function rollSaveForCreature(creature, saveType, saveDc) {
  const bonus = creature?.saveBonuses?.[saveType] ?? 0;
  const roll = rollD20();
  const total = roll + bonus;
  const success = total >= saveDc;
  return { roll, total, bonus, success };
}

export function applyDamageToTarget(combatSummary, targetName, rawDamage, damageTypes, campaignName) {
  if (!combatSummary) return null;
  const creature = combatSummary.creatures.find(c => c.name === targetName);
  if (!creature) return null;

  const finalDamage = computeDamageAfterResistances(rawDamage, damageTypes || [], creature.resistances, creature.immunities);
  const oldHp = creature.currentHp;
  const newHp = Math.max(0, oldHp - finalDamage);
  creature.currentHp = newHp;

  const wasAlive = oldHp > 0;
  const isNowUnconscious = newHp <= 0;

  if (creature.concentration && finalDamage > 0) {
    creature.concentration.dc = Math.max(10, Math.floor(finalDamage / 2));
  }

  storage.set('combatSummary', combatSummary, campaignName);

  logDamageApplication(creature, finalDamage, oldHp, newHp, campaignName);

  let npcConcentrationBroken = false;
  if (creature.type === 'player') {
    if (wasAlive && isNowUnconscious) {
      const promptId = utils.guid();
      sendDeathSavePrompt(campaignName, {
        promptId,
        targetName: creature.name,
      });
    }

    if (creature.concentration && finalDamage > 0) {
      const promptId = utils.guid();
      sendConcentrationPrompt(campaignName, {
        promptId,
        targetName: creature.name,
        spellName: creature.concentration.spell,
        dc: creature.concentration.dc,
      });
    }
  } else {
    if (creature.concentration && finalDamage > 0) {
      const saveBonus = creature?.saveBonuses?.['con'] ?? 0;
      const { success, roll, total } = rollConcentrationSave(saveBonus, creature.concentration.dc);
      if (!success) {
        const spellName = creature.concentration.spell;
        const dc = creature.concentration.dc;
        creature.concentration = null;
        npcConcentrationBroken = true;
        fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'concentration-broken',
            characterName: creature.name,
            spellName,
            roll,
            total,
            dc,
          }),
        }).catch(() => {});
      } else {
        fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'concentration-save',
            characterName: creature.name,
            spellName: creature.concentration.spell,
            roll,
            total,
            dc: creature.concentration.dc,
            success: true,
          }),
        }).catch(() => {});
      }
    }
  }

  if (npcConcentrationBroken) {
    storage.set('combatSummary', combatSummary, campaignName);
  }

  window.dispatchEvent(new CustomEvent('combat-summary-updated'));

  return { finalDamage, oldHp, newHp, damageReduced: finalDamage < rawDamage };
}

function logDamageApplication(creature, damage, oldHp, newHp, campaignName) {
  const delta = newHp - oldHp;
  const isDead = newHp <= 0;
  const wasDead = oldHp <= 0;
  const wasBloodied = oldHp > 0 && oldHp <= Math.floor(creature.maxHp / 2);
  const isBloodied = newHp > 0 && newHp <= Math.floor(creature.maxHp / 2);

  let threshold;
  if (!wasDead && isDead) threshold = 'dead';
  else if (!wasBloodied && isBloodied) threshold = 'bloodied';
  else if (wasBloodied && !isBloodied && newHp > 0) threshold = 'recovering';

  const entry = {
    type: 'hp_change',
    targetName: creature.name,
    delta,
    currentHp: newHp,
    maxHp: creature.maxHp,
    isHealing: false,
    isUnconscious: isDead,
   };
  if (threshold) entry.threshold = threshold;

  if (creature.type === 'player') {
    storage.setProperty(creature.name, 'currentHitPoints', newHp, campaignName);
    if (oldHp > 0 && isDead) {
      storage.setProperty(creature.name, 'deathSaves', [false, false, false], campaignName);
      storage.setProperty(creature.name, 'deathFailures', [false, false, false], campaignName);
       }
     }

  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  }).catch(() => {});
}
