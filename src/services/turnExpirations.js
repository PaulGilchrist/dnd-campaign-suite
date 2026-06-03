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
    const nowRound = getCurrentCombatRound();
    setRuntimeValue(attackerName, KEY, [
            ...list,
            { target: targetName, effects, appliedRound: nowRound }
        ], campaignName);
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
