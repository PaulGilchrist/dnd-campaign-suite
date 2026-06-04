import { getRuntimeValue, setRuntimeValue } from '../hooks/useRuntimeState.js';
import utils from './utils.js';

const KEY = 'pendingTurnExpirations';

export function getCurrentCombatRound() {
    try {
        const data = JSON.parse(localStorage.getItem('combatSummary') || '{}');
        return data.round || 1;
        } catch {
        return 1;
        }
}

function getActiveCreatureName() {
    try {
        return JSON.parse(localStorage.getItem('activeCreatureName'));
       } catch {
        return null;
       }
}

export function addTurnExpiration(attackerName, targetName, effects, campaignName) {
    const list = getRuntimeValue(attackerName, KEY) || [];
    const currentRound = getCurrentCombatRound();
    setRuntimeValue(attackerName, KEY, [
         ...list,
         { target: targetName, effects, appliedRound: currentRound }
     ], campaignName);
}

export function clearAllExpirationEffects(characterName, campaignName) {
    if (!characterName || !campaignName) return;

    const charLower = characterName.toLowerCase();

     // Get all current combat creatures for validation
    let currentCreatures = [];
    try {
        const combatData = JSON.parse(localStorage.getItem('combatSummary') || '{}');
        currentCreatures = combatData.creatures || [];
      } catch (e) { /* no combat data */ }

    const inCombat = currentCreatures.length ? new Set(currentCreatures.map(c => utils.getName(c.name).toLowerCase())) : null;

     // --- "From me": clear all effects I have on other targets ---
    const myList = getRuntimeValue(characterName, KEY) || [];
    for (const entry of myList) {
        clearExpirationEffects(entry.effects, entry.target, characterName, campaignName);
      }
    setRuntimeValue(characterName, KEY, [], campaignName);

     // --- Scan all runtime stores for "to me" and stale entries ---
    const allKeys = Object.keys(localStorage);
    for (const key of allKeys) {
        if (!key || key === 'combatSummary' || key === 'activeCreatureName') continue;
        if (key.toLowerCase() === charLower) continue;

       const list = getRuntimeValue(key, KEY) || [];
        if (!list.length) continue;

        let kept = [];
      for (const entry of list) {
            const targetLower = utils.getName(entry.target).toLowerCase();
            const keyLower = key.toLowerCase();

           // Clear if the effect targets me
            if (targetLower === charLower) {
                clearExpirationEffects(entry.effects, entry.target, key, campaignName);
                 continue;
              }

           // If combat data exists, clear stale entries (attacker or target not in combat)
            if (inCombat) {
                if (!inCombat.has(keyLower)) {
                    clearExpirationEffects(entry.effects, entry.target, key, campaignName);
                     continue;
                  }
                if (!inCombat.has(targetLower)) {
                    clearExpirationEffects(entry.effects, entry.target, key, campaignName);
                     continue;
                  }
              }

           kept.push(entry);
          }

        setRuntimeValue(key, KEY, kept, campaignName);
      }
}

export function expireStaleEffects(campaignName) {
    const currentRound = getCurrentCombatRound();
    const activeName = getActiveCreatureName();
    if (!activeName) return;

    try {
        const combatData = JSON.parse(localStorage.getItem('combatSummary') || '{}');
        const creatures = combatData.creatures || [];

        for (const attacker of creatures) {
            if (utils.getName(attacker.name) !== utils.getName(activeName)) continue;

            const list = getRuntimeValue(attacker.name, KEY) || [];
            if (!list.length) continue;

            let newEntries = [];
            for (const item of list) {
                if (item.appliedRound < currentRound) {
                    clearExpirationEffects(item.effects, item.target, attacker.name, campaignName);
                    } else {
                      newEntries.push(item);
                     }
                 }

           setRuntimeValue(attacker.name, KEY, newEntries, campaignName);
            }
         } catch (e) { /* ignore */ }
}

function clearExpirationEffects(effects, targetName, attackerName, campaignName) {
    if (!effects || !Array.isArray(effects)) return;

    for (const effect of effects) {
        switch (effect.type) {
             case 'stunned':
                 if (effect.condition === 'speed_halved') {
                     setRuntimeValue(targetName, `stunned_speedHalved`, null, campaignName);
                      } else if (effect.condition === 'stunned') {
                       removeActiveCondition(targetName, 'stunned', campaignName);
                         }
               break;

            case 'advantage_on_target': {
                const advKey = `_advantageOn_${targetName}`;
                const storedAdv = getRuntimeValue(attackerName, advKey) || [];
                 if (Array.isArray(storedAdv) && storedAdv.includes(targetName)) {
                     setRuntimeValue(
                         attackerName,
                         advKey,
                          storedAdv.filter(tn => tn !== targetName),
                          campaignName
                        );
                    }
               break;
                }

            default:
                break;
             }
          }
}

function removeActiveCondition(targetName, conditionName, campaignName) {
    const condList = getRuntimeValue(targetName, 'activeConditions') || [];
    if (!Array.isArray(condList)) return;
    const filtered = condList.filter(c => utils.getName(c) !== utils.getName(conditionName));
    setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
}
