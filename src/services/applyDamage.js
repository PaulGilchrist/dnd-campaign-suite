import { getRuntimeValue, setRuntimeValue } from '../hooks/useRuntimeState.js';
import storage from './storage.js';
import { rollD20 } from './diceRoller.js';
import utils from './utils.js';
import { sendDeathSavePrompt, sendConcentrationPrompt } from './savePromptService.js';
import { rollConcentrationSave } from './concentrationRules.js';

export function computeDamageAfterResistances(rawDamage, damageTypes, resistances, immunities) {
  if (!damageTypes || damageTypes.length === 0) throw new Error('computeDamageAfterResistances: damageTypes is required');
  for (const dt of damageTypes) {
    if (!dt) throw new Error('computeDamageAfterResistances: each damageType must be a non-empty string');
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

export function rollSaveForCreature(creature, saveType, saveDc, disadvantage = false) {
  const bonus = creature?.saveBonuses?.[saveType] ?? 0;
  const roll1 = rollD20();
  const roll2 = disadvantage ? rollD20() : roll1;
  const finalRoll = disadvantage ? Math.min(roll1, roll2) : roll1;
  const total = finalRoll + bonus;
  const success = total >= saveDc;
  return { roll: finalRoll, total, bonus, success, rawRolls: [roll1, roll2] };
}

export function applyDamageToTarget(combatSummary, targetName, rawDamage, damageTypes, campaignName, characters) {
  if (!combatSummary) return null;
  const creature = combatSummary.creatures.find(c => c.name === targetName);
  if (!creature) return null;

   const isPlayer = creature.type === 'player';
   const playerStats = isPlayer ? (characters || []).find(c => c.name === targetName || c.name.startsWith(targetName + ' ')) : null;
   const playerComputed = playerStats?.computedStats || playerStats;
   const resistances = isPlayer ? (playerComputed?.resistances || []) : (creature.resistances || []);
   const immunities = isPlayer ? (playerComputed?.immunities || []) : (creature.immunities || []);
  const finalDamage = computeDamageAfterResistances(rawDamage, damageTypes || [], resistances, immunities);

  let oldHp, newHp;
  if (isPlayer) {
    oldHp = getRuntimeValue(creature.name, 'currentHitPoints') ?? 0;
    newHp = Math.max(0, oldHp - finalDamage);
    setRuntimeValue(creature.name, 'currentHitPoints', newHp, campaignName);
  } else {
    oldHp = creature.currentHp;
    newHp = Math.max(0, oldHp - finalDamage);
    creature.currentHp = newHp;
  }

  if (finalDamage > 0) {
    if (isPlayer) {
      const conditions = getRuntimeValue(creature.name, 'activeConditions') || [];
      if (conditions.some(c => String(c).toLowerCase() === 'frightened')) {
        const filtered = conditions.filter(c => String(c).toLowerCase() !== 'frightened');
        setRuntimeValue(creature.name, 'activeConditions', filtered, campaignName);
        fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'condition',
            action: 'removed',
            characterName: creature.name,
            condition: 'Frightened',
            reason: 'took damage',
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      }
    } else {
      const hadFrightened = creature.conditions.some(c => c.key === 'frightened');
      if (hadFrightened) {
        creature.conditions = creature.conditions.filter(c => c.key !== 'frightened');
        fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'condition',
            action: 'removed',
            characterName: creature.name,
            condition: 'Frightened',
            reason: 'took damage',
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      }
    }
  }

  const wasAlive = oldHp > 0;
  const isNowUnconscious = newHp <= 0;

  if (creature.concentration && finalDamage > 0) {
    creature.concentration.dc = Math.max(10, Math.floor(finalDamage / 2));
  }

  logDamageApplication(creature, finalDamage, oldHp, newHp, campaignName);

  let npcConcentrationBroken = false;
  let combatSummaryChanged = false;
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
      combatSummaryChanged = true;
    }
  } else {
    combatSummaryChanged = true;
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

  if (combatSummaryChanged || npcConcentrationBroken) {
    storage.set('combatSummary', combatSummary, campaignName);
  }

  window.dispatchEvent(new CustomEvent('combat-summary-updated'));

  return { finalDamage, oldHp, newHp, damageReduced: finalDamage < rawDamage };
}

function logDamageApplication(creature, damage, oldHp, newHp, campaignName) {
  const maxHp = creature.type === 'player'
    ? (getRuntimeValue(creature.name, 'hitPoints') ?? newHp)
    : creature.maxHp;
  const delta = newHp - oldHp;
  const isDead = newHp <= 0;
  const wasDead = oldHp <= 0;
  const wasBloodied = oldHp > 0 && oldHp <= Math.floor(maxHp / 2);
  const isBloodied = newHp > 0 && newHp <= Math.floor(maxHp / 2);

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
    setRuntimeValue(creature.name, 'currentHitPoints', newHp, campaignName);
    if (oldHp > 0 && isDead) {
      setRuntimeValue(creature.name, 'deathSaves', [false, false, false], campaignName);
      setRuntimeValue(creature.name, 'deathFailures', [false, false, false], campaignName);
       }
     }

  fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  }).catch(() => {});
}
