import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import utils from '../ui/utils.js';
import storage from '../ui/storage.js';
import { getCurrentCombatRound, getActiveCreatureName, getCombatSummary } from '../encounters/combatData.js';

const KEY = 'pendingExpirations';

export function addExpiration(attackerName, targetName, effects, campaignName, rounds) {
    const list = getRuntimeValue(attackerName, KEY) || [];
    const currentRound = getCurrentCombatRound();
    setRuntimeValue(attackerName, KEY, [
         ...list,
         { target: targetName, effects, appliedRound: currentRound, expiryRounds: rounds || 1 }
     ], campaignName);
}

export function clearAllExpirationEffects(characterName, campaignName) {
    if (!characterName || !campaignName) return;

     // Clear all active buffs (Innate Sorcery, Reckless Attack, etc.)
    setRuntimeValue(characterName, 'activeBuffs', [], campaignName);
    setRuntimeValue(characterName, 'mantleOfMajestyActive', null, campaignName);

    const charLower = characterName.toLowerCase();

     // --- "From me": clear all effects I have on other targets ---
    const myList = getRuntimeValue(characterName, KEY) || [];
    for (const entry of myList) {
        clearExpirationEffects(entry.effects, entry.target, characterName, campaignName);
      }
    setRuntimeValue(characterName, KEY, [], campaignName);

     // --- Scan all runtime stores for "to me" entries ---
    const allKeys = Object.keys(localStorage);
    for (const key of allKeys) {
        if (!key || key === 'combatSummary' || key === 'activeCreatureName') continue;
        if (key.toLowerCase() === charLower) continue;

       const list = getRuntimeValue(key, KEY) || [];
        if (!list.length) continue;

        let kept = [];
      for (const entry of list) {
            const targetLower = utils.getName(entry.target).toLowerCase();

           // Clear if the effect targets me
            if (targetLower === charLower) {
                clearExpirationEffects(entry.effects, entry.target, key, campaignName);
                 continue;
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
        const combatData = getCombatSummary() || {};
        const creatures = combatData.creatures || [];

        for (const attacker of creatures) {
            if (utils.getName(attacker.name) !== utils.getName(activeName)) continue;

            const list = getRuntimeValue(attacker.name, KEY) || [];
            if (!list.length) continue;

            let newEntries = [];
            for (const item of list) {
                const rounds = item.expiryRounds || 1;
                if (currentRound >= item.appliedRound + rounds) {
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

            case 'fly_speed_equals_walk_speed': {
                const buffs = getRuntimeValue(targetName, 'activeBuffs') || [];
                if (Array.isArray(buffs)) {
                    setRuntimeValue(
                        targetName,
                        'activeBuffs',
                        buffs.filter(b => b.effect !== 'fly_speed_equals_walk_speed'),
                        campaignName
                    );
                }
                break;
            }

            case 'ice_walk': {
                const buffs = getRuntimeValue(targetName, 'activeBuffs') || [];
                if (Array.isArray(buffs)) {
                    setRuntimeValue(
                        targetName,
                        'activeBuffs',
                        buffs.filter(b => b.effect !== 'ice_walk'),
                        campaignName
                    );
                }
                break;
            }

            case 'speed_boost': {
                const buffs = getRuntimeValue(targetName, 'activeBuffs') || [];
                if (Array.isArray(buffs)) {
                    setRuntimeValue(
                        targetName,
                        'activeBuffs',
                        buffs.filter(b => b.effect !== 'speed_boost'),
                        campaignName
                    );
                }
                break;
            }

            case 'remove_active_buff': {
                const allBuffs = getRuntimeValue(targetName, 'activeBuffs') || [];
                if (Array.isArray(allBuffs)) {
                    setRuntimeValue(
                        targetName,
                        'activeBuffs',
                        allBuffs.filter(b => b.name !== effect.buffName),
                        campaignName
                    );
                }
                break;
            }

            case 'remove_bardic_inspiration': {
                setRuntimeValue(targetName, 'bardicInspirationDie', null, campaignName);
                setRuntimeValue(targetName, 'bardicInspirationGrantedBy', null, campaignName);
                setRuntimeValue(targetName, 'bardicInspirationCombatOptions', null, campaignName);
                break;
            }

            case 'inspiring_movement_no_oa':
                setRuntimeValue(targetName, 'inspiringMovementNoOA', null, campaignName);
                break;

            case 'inspiring_movement_granted':
                setRuntimeValue(targetName, 'inspiringMovementGranted', null, campaignName);
                break;

            case 'unbreakable_majesty':
                setRuntimeValue(targetName, 'unbreakableMajestyActive', null, campaignName);
                setRuntimeValue(targetName, 'unbreakableMajestySaveDc', null, campaignName);
                break;

            case 'condition':
                removeActiveCondition(targetName, effect.condition, campaignName);
                removeNpcCondition(targetName, effect.condition, campaignName);
                break;

            default:
                break;
             }
          }
}

function removeNpcCondition(targetName, conditionName, campaignName) {
    try {
        const combatData = getCombatSummary() || {};
        const creatures = combatData.creatures || [];
        const creature = creatures.find(c => utils.getName(c.name) === utils.getName(targetName));
        if (creature && creature.conditions) {
            creature.conditions = creature.conditions.filter(c => c.key !== conditionName);
            storage.set('combatSummary', combatData, campaignName);
            window.dispatchEvent(new CustomEvent('combat-summary-updated'));
        }
    } catch (e) { /* ignore */ }
}

function removeActiveCondition(targetName, conditionName, campaignName) {
    const condList = getRuntimeValue(targetName, 'activeConditions') || [];
    if (!Array.isArray(condList)) return;
    const filtered = condList.filter(c => utils.getName(c) !== utils.getName(conditionName));
    setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
}
