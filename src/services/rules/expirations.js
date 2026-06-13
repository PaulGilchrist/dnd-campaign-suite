import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import { evaluateAutoExpression } from '../combat/automationExpressions.js';
import utils from '../ui/utils.js';
import storage from '../ui/storage.js';
import { getCurrentCombatRound, getActiveCreatureName, getCombatSummary } from '../encounters/combatData.js';
import { addEntry } from '../ui/logService.js';

const ALL_DAMAGES_EXCEPT_FORCE = [
    'acid', 'bludgeoning', 'cold', 'fire', 'lightning',
    'piercing', 'poison', 'slashing', 'thunder',
    'necrotic', 'psychic', 'radiant'
];

const KEY = 'pendingExpirations';

export function applyTurnStartEffects(activeName, playerStats, campaignName) {
    if (!activeName || !playerStats) return;

    const turnStartEffects = playerStats.turnStartEffects || [];
    for (const effect of turnStartEffects) {
        if (effect.type === 'heroic_inspiration') {
            const currentInspiration = getRuntimeValue(activeName, 'hasInspiration') || false;
            if (!currentInspiration) {
                setRuntimeValue(activeName, 'hasInspiration', true, campaignName);
            }
        }
        if (effect.type === 'condition_removal') {
            const conditions = getRuntimeValue(activeName, 'activeConditions') || [];
            const removalConditions = new Set(effect.conditions.map(c => c.toLowerCase()));
            const filtered = conditions.filter(c => {
                const condName = String(c).toLowerCase();
                return !removalConditions.has(condName);
            });
            if (filtered.length !== conditions.length) {
                setRuntimeValue(activeName, 'activeConditions', filtered, campaignName);
            }
        }
        if (effect.type === 'superior_defense') {
            applySuperiorDefenseTurnStart(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'flurry_healing_harm') {
            applyFlurryHealingHarmTurnStart(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'holy_nimbus_radiant_damage') {
            applyHolyNimbusRadiantDamage(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'living_legend_turn_start') {
            setRuntimeValue(activeName, 'unerringStrikeUsed', false, campaignName);
        }
        if (effect.type === 'elder_champion_regeneration') {
            applyElderChampionRegeneration(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'dread_ambush_speed') {
            applyDreadAmbushSpeedTurnStart(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'umbral_sight') {
            applyUmbralSightTurnStart(activeName, playerStats, effect, campaignName);
        }
        if (effect.type === 'steady_aim_clear') {
            applySteadyAimClearTurnStart(activeName, playerStats, effect, campaignName);
        }
    }

    // Clean up Multiattack Defense effects at start of each creature's turn
    const allTargetEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    if (allTargetEffects.length > 0) {
        const cleaned = allTargetEffects.filter(te => te.effect !== 'multiattack_defense');
        if (cleaned.length !== allTargetEffects.length) {
            setRuntimeValue(campaignName, 'targetEffects', cleaned, campaignName);
        }
    }
}

async function applySuperiorDefenseTurnStart(activeName, playerStats, effect, campaignName) {
    const conditions = getRuntimeValue(activeName, 'activeConditions') || [];
    const isIncapacitated = conditions.some(c => String(c).toLowerCase() === 'incapacitated');
    if (isIncapacitated) {
        return;
    }

    const stored = getRuntimeValue(activeName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    if (activeBuffs.some(b => b.name === 'Superior Defense')) {
        return;
    }

    const cost = effect.cost || 3;
    const maxFocus = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.focus_points || 0;
    const currentFocus = Number(getRuntimeValue(activeName, 'focusPoints', campaignName) ?? maxFocus);

    if (currentFocus < cost) {
        return;
    }

    await setRuntimeValue(activeName, 'focusPoints', currentFocus - cost, campaignName);

    const buff = {
        name: 'Superior Defense',
        effect: 'damage_resistance',
        duration: '1_minute',
        resistanceTypes: ALL_DAMAGES_EXCEPT_FORCE,
    };

    const newBuffs = [...activeBuffs, buff];
    setRuntimeValue(activeName, 'activeBuffs', newBuffs, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: activeName,
        abilityName: 'Superior Defense',
        description: `${activeName} activated Superior Defense at start of turn. Resistance to all damage except Force.`,
    }).catch(() => {});
}

async function applyFlurryHealingHarmTurnStart(activeName, playerStats, effect, campaignName) {
    const expressions = {
        'WIS modifier minimum 1': 'Math.max(1, WIS modifier)',
    };
    const expr = expressions[effect.usesExpression] || effect.usesExpression;
    const resolvedExpr = expr.replace(/WIS modifier/gi, playerStats.abilities?.find(a => a.name === 'Wisdom')?.bonus || 0);

    let uses;
    try {
        uses = new Function(`"use strict"; return (${resolvedExpr})`)();
    } catch {
        uses = 1;
    }
    if (typeof uses !== 'number' || isNaN(uses) || uses < 1) {
        uses = 1;
    }

    await setRuntimeValue(activeName, 'flurryHealingHarmUses', uses, campaignName);
}

async function applyHolyNimbusRadiantDamage(activeName, playerStats, effect, campaignName) {
    const holyNimbusActive = getRuntimeValue(activeName, 'holyNimbusActive', campaignName);
    if (!holyNimbusActive) return;

    const combatSummary = getCombatSummary();
    if (!combatSummary) return;

    const creatures = combatSummary.creatures || [];
    const damageExpression = effect.damageExpression || 'CHA modifier + proficiency_bonus';

    const prof = playerStats.proficiency || 0;
    const chaMod = playerStats.abilities?.find(a => a.name === 'Charisma')?.bonus || 0;

    let expr = damageExpression
        .replace(/proficiency_bonus/gi, prof)
        .replace(/CHA modifier/gi, chaMod);

    let damage;
    try {
        damage = new Function(`"use strict"; return (${expr})`)();
    } catch {
        damage = prof + chaMod;
    }

    if (typeof damage !== 'number' || isNaN(damage) || damage <= 0) return;

    for (const creature of creatures) {
        const creatureName = utils.getName(creature.name);
        if (creatureName === utils.getName(activeName)) continue;

        const creatureType = creature.type || '';
        if (creatureType !== 'fiend' && creatureType !== 'undead') continue;

        try {
            const currentHp = creature.hit_points?.current ?? creature.currentHp ?? 0;
            const newHp = Math.max(0, currentHp - damage);
            creature.hit_points = creature.hit_points || {};
            creature.hit_points.current = newHp;
            if (creature.currentHp != null) {
                creature.currentHp = newHp;
            }

            await addEntry(campaignName, {
                type: 'damage',
                characterName: activeName,
                targetName: creatureName,
                damageType: 'radiant',
                damageAmount: damage,
                description: `Holy Nimbus radiant damage: ${damage} radiant to ${creatureName}`,
                timestamp: Date.now(),
            }).catch(() => {});
        } catch { /* ignore per-creature errors */ }
    }

    storage.set('combatSummary', combatSummary, campaignName);
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
}

async function applyElderChampionRegeneration(activeName, playerStats, effect, campaignName) {
    const elderChampionActive = getRuntimeValue(activeName, 'elderChampionActive', campaignName);
    if (!elderChampionActive) return;

    const healAmount = effect.healExpression ? evaluateAutoExpression(effect.healExpression, playerStats) : 10;
    if (typeof healAmount !== 'number' || isNaN(healAmount) || healAmount <= 0) return;

    const maxHp = getRuntimeValue(activeName, 'hitPoints', campaignName) ?? playerStats.hitPoints ?? 100;
    const currentHp = getRuntimeValue(activeName, 'currentHitPoints', campaignName) ?? getRuntimeValue(activeName, 'hitPoints', campaignName) ?? maxHp;
    const newHp = Math.min(maxHp, currentHp + healAmount);

    await setRuntimeValue(activeName, 'currentHitPoints', newHp, campaignName);
}

async function applyDreadAmbushSpeedTurnStart(activeName, playerStats, effect, campaignName) {
    const combatData = getCombatSummary();
    if (!combatData) return;
    
    const currentRound = combatData.round || 1;
    if (currentRound !== 1) return;
    
    const isActive = getRuntimeValue(activeName, 'dreadAmbushSpeedActive', campaignName);
    if (isActive) return;
    
    await setRuntimeValue(activeName, 'dreadAmbushSpeedActive', true, campaignName);
    
    const bonus = parseInt(effect.bonusExpression, 10) || 10;
    
    const activeBuffs = getRuntimeValue(activeName, 'activeBuffs', campaignName) || [];
    const newBuffs = [...activeBuffs, {
        name: "Dread Ambush",
        effect: 'speed_boost',
        duration: 'until_end_of_turn',
        speedBonus: bonus,
    }];
    await setRuntimeValue(activeName, 'activeBuffs', newBuffs, campaignName);
}

async function applyUmbralSightTurnStart(activeName, playerStats, effect, campaignName) {
    const inDarkness = getRuntimeValue(activeName, 'umbralSightDarknessActive', campaignName);
    const storedConditions = getRuntimeValue(activeName, 'activeConditions') || [];
    const hasInvisible = storedConditions.some(c => String(c).toLowerCase() === 'invisible');

    if (inDarkness && !hasInvisible) {
        const newConditions = [...storedConditions, 'invisible'];
        await setRuntimeValue(activeName, 'activeConditions', newConditions, campaignName);
    } else if (!inDarkness && hasInvisible) {
        const filtered = storedConditions.filter(c => String(c).toLowerCase() !== 'invisible');
        await setRuntimeValue(activeName, 'activeConditions', filtered, campaignName);
    }
}

async function applySteadyAimClearTurnStart(activeName, playerStats, effect, campaignName) {
    // Clear speed_zero condition and movement flag at start of next turn
    const storedConds = getRuntimeValue(activeName, 'activeConditions') || [];
    const filtered = storedConds.filter(c => String(c).toLowerCase() !== 'speed_zero');
    if (filtered.length !== storedConds.length) {
        await setRuntimeValue(activeName, 'activeConditions', filtered, campaignName);
    }
    await setRuntimeValue(activeName, 'steadyAimMovedThisTurn', false, campaignName);
    await setRuntimeValue(activeName, 'steadyAimSpeedZero', false, campaignName);
}

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

            case 'fly_speed_20_hover': {
                const buffs = getRuntimeValue(targetName, 'activeBuffs') || [];
                if (Array.isArray(buffs)) {
                    setRuntimeValue(
                        targetName,
                        'activeBuffs',
                        buffs.filter(b => b.effect !== 'fly_speed_20_hover'),
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

            case 'peerless_athlete_end': {
                setRuntimeValue(targetName, 'peerlessAthleteActive', false, campaignName);
                const buffs = getRuntimeValue(targetName, 'activeBuffs') || [];
                if (Array.isArray(buffs)) {
                    setRuntimeValue(
                        targetName,
                        'activeBuffs',
                        buffs.filter(b => b.effect !== 'peerless_athlete'),
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

            case 'remove_natures_sanctuary':
                setRuntimeValue(targetName, 'naturesSanctuaryActive', null, campaignName);
                setRuntimeValue(targetName, 'naturesSanctuaryMoves', null, campaignName);
                setRuntimeValue(targetName, 'naturesSanctuaryCubeX', null, campaignName);
                setRuntimeValue(targetName, 'naturesSanctuaryCubeY', null, campaignName);
                setRuntimeValue(targetName, 'naturesSanctuaryRange', null, campaignName);
                setRuntimeValue(targetName, 'naturesSanctuaryResistance', null, campaignName);
                break;

            case 'remove_bulwark_of_force':
                setRuntimeValue(targetName, 'bulwarkOfForceActive', null, campaignName);
                setRuntimeValue(targetName, 'bulwarkOfForceTargets', null, campaignName);
                break;

            case 'unbreakable_majesty':
                setRuntimeValue(targetName, 'unbreakableMajestyActive', null, campaignName);
                setRuntimeValue(targetName, 'unbreakableMajestySaveDc', null, campaignName);
                break;

            case 'remove_cosmic_omen':
                setRuntimeValue(targetName, 'cosmicOmenEffect', null, campaignName);
                break;

            case 'condition':
                removeActiveCondition(targetName, effect.condition, campaignName);
                removeNpcCondition(targetName, effect.condition, campaignName);
                break;

            case 'speed_zero': {
                removeActiveCondition(targetName, 'speed_zero', campaignName);
                removeNpcCondition(targetName, 'speed_zero', campaignName);
                break;
            }

            case 'avenging_angel_aura': {
                const auraTargets = getRuntimeValue(attackerName, 'avengingAngelAuraTargets', campaignName) || [];
                setRuntimeValue(
                    attackerName,
                    'avengingAngelAuraTargets',
                    auraTargets.filter(t => t !== targetName),
                    campaignName
                );
                break;
            }

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
