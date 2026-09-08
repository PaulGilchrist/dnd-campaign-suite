import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { MELEE_REACH_FEET } from '../../../combat/baseCombatActions.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyDamageToTarget, computeDamageAfterSave } from '../../../rules/combat/applyDamage.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';
import { isPolearmWeapon } from '../../common/polearmUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';

// CLA-361: Thought Shield ("Whenever a creature deals Psychic damage to you, that
// creature takes the same amount of damage that you take") — once-per-round reaction
// latch keyed on the holder's playerStats.name, round from a FRESH getCombatContext
// (CLA-335/CLA-315/CLA-297 family). Cleared at round wrap in initiative.jsx /
// navigationHandlers.js.
const THOUGHT_SHIELD_ROUND_KEY = '_Thought_Shield_usedRound';

// CLA-297: Retaliation ("when you take damage from a creature within 5 feet of you")
// once-per-round reaction latch, round-keyed like the CLA-274 Psychic Blade precedent
// (re-arms when the combat round advances; also cleared at round wrap in
// initiative.jsx / navigationHandlers.js).
const ADJACENT_DAMAGE_REACTION_ROUND_KEY = '_Retaliation_usedRound';

function refusalPopup(action, auto, description) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description,
            automation: auto,
        },
    };
}

// Gates for the generic no-save reaction_damage consumers whose data declares
// trigger 'damage_from_adjacent_creature' (CLA-297 Retaliation). Other triggers
// (Guardian's ally-defense OA, Reactive Strike's polearm reach) are NOT gated here.
async function gateAdjacentDamageReaction(action, auto, playerStats, lastAttackResult, campaignName) {
    const playerName = playerStats.name;
    const lastAttack = lastAttackResult.attackEvent;
    const attackerName = lastAttackResult.attackerName;

    if (!lastAttack || !attackerName) {
        return refusalPopup(action, auto, `${action.name}: No recent attack found. ${action.name} triggers when a creature within 5 feet of you deals damage to you.`);
    }
    if (attackerName === playerName) {
        return refusalPopup(action, auto, `${action.name}: you cannot attack yourself — the triggering attack must come from another creature.`);
    }
    if (lastAttackResult.targetName !== playerName) {
        return refusalPopup(action, auto, `You were not the target of the last attack (${lastAttackResult.targetName} was). ${action.name} only triggers when you take damage.`);
    }
    if (!(lastAttackResult.totalDamage > 0)) {
        return refusalPopup(action, auto, `The last attack dealt you no damage. ${action.name} triggers only when you take damage.`);
    }
    if (lastAttack.weaponType === 'ranged') {
        return refusalPopup(action, auto, `The last attack was a Ranged attack. ${action.name} only triggers when a creature within 5 feet of you deals damage to you.`);
    }
    const within5ft = await isWithinRange(playerName, attackerName, 5);
    if (!within5ft) {
        return refusalPopup(action, auto, `${attackerName} is not within 5 feet of you. ${action.name} requires the attacker to be adjacent.`);
    }
    const combatContext = await getCombatContext(campaignName);
    const currentRound = combatContext?.round || 1;
    const usedRound = Number(getRuntimeValue(playerName, ADJACENT_DAMAGE_REACTION_ROUND_KEY, campaignName) ?? 0);
    if (usedRound === currentRound) {
        return refusalPopup(action, auto, `You have already used ${action.name} this round — your Reaction is spent until your next turn.`);
    }
    return null;
}

function getChosenResistanceTypes(playerName, campaignName) {
    const stored = getRuntimeValue(playerName, '_Energy_Resistances_chosenTypes', campaignName);
    return Array.isArray(stored) ? stored : [];
}

function getRuntimeUsesKey(featureName) {
    return featureName.toLowerCase().replace(/\s+/g, '') + 'Uses';
}

async function consumeResourceCost(auto, playerStats, campaignName, actionName) {
    if (auto.resourceCost === 'focus_point') {
        const isHandOfHarm = actionName === 'Hand of Harm';
        const hasFlurryHealingHarm = playerStats.specialActions?.some(f => f.name === "Flurry of Healing and Harm");
        const skipFP = isHandOfHarm && hasFlurryHealingHarm;

        if (!skipFP) {
            const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
            const maxFocus = classLevel?.focus_points || 0;
            const currentFocus = Number(getRuntimeValue(playerStats.name, 'focusPoints', campaignName) ?? maxFocus);

            if (currentFocus <= 0) {
                return { ok: false, message: 'No Focus Points remaining.' };
            }

            await setRuntimeValue(playerStats.name, 'focusPoints', currentFocus - 1, campaignName);
            return { ok: true };
        }
    }

    if (auto.uses_expression) {
        const usesKey = getRuntimeUsesKey(actionName);
        const maxUses = evaluateAutoExpression(auto.uses_expression, playerStats);
        const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? maxUses);
        if (currentUses <= 0) {
            return { ok: false, message: `${actionName} has no uses remaining.` };
        }
        await setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);
        return { ok: true };
    }

    return { ok: true };
}

export async function handle(action, playerStats, campaignName, _mapName, characters = []) {
    const auto = action.automation;

    if (auto?.trigger === 'psychic_damage_received') {
        return await handleThoughtShield(action, playerStats, campaignName);
    }

    if (auto?.trigger === 'creature_enters_reach_while_holding_polearm') {
        const lastAttackResult = await findLastAttack(campaignName);
        const lastAttack = lastAttackResult.attackEvent;
        const weaponName = lastAttack?.damageName || lastAttack?.attackName;
        const hasWeapon = await isPolearmWeapon(weaponName);
        if (!hasWeapon) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name} requires you to be holding a Quarterstaff, Spear, or a weapon with the Heavy and Reach properties.`,
                    automation: auto,
                },
            };
        }
    }

    if (auto?.trigger === 'damage_taken_of_chosen_resistance_type') {
        return await handleEnergyRedirection(action, playerStats, campaignName);
    }

    if (!auto.saveType) {
        const lastAttackResult = await findLastAttack(campaignName);
        const targetName = lastAttackResult.attackerName || null;

        if (auto.trigger === 'damage_from_adjacent_creature') {
            const refusal = await gateAdjacentDamageReaction(action, auto, playerStats, lastAttackResult, campaignName);
            if (refusal) return refusal;
        }

        const meleeAttacks = (playerStats.attacks || []).filter(
            a => a.type === 'Action' && a.range === MELEE_REACH_FEET
        );
        const attack = meleeAttacks.length > 0 ? meleeAttacks[0] : (playerStats.attacks || [])[0];

        if (!attack) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name}: No melee attack available.`,
                    automation: auto,
                },
            };
        }

        if (auto.trigger === 'damage_from_adjacent_creature') {
            const combatContext = await getCombatContext(campaignName);
            const currentRound = combatContext?.round || 1;
            await setRuntimeValue(playerStats.name, ADJACENT_DAMAGE_REACTION_ROUND_KEY, currentRound, campaignName);
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: action.name,
                description: `${playerStats.name} used ${action.name} (Reaction) — melee attack against ${targetName} in response to the ${lastAttackResult.totalDamage} damage taken from them.`,
                targetName,
                timestamp: Date.now(),
            }).catch((e) => { console.error('[reactionDamage] Error logging ability_use:', e); });
        }

        return {
            type: 'attack_roll',
            payload: {
                attack,
                targetName,
                sourceName: action.name,
            },
        };
    }

    const targetInfo = await resolveTarget(campaignName, playerStats.name);
    if (!targetInfo?.target) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} requires a target. Select a creature in combat and try again.`,
                automation: auto,
            },
        };
    }
    const targetName = targetInfo.target.name;

    const resourceResult = await consumeResourceCost(auto, playerStats, campaignName, action.name);
    if (!resourceResult.ok) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: resourceResult.message,
                automation: auto,
            },
        };
    }

    const saveDc = buildSaveDc(auto, playerStats);
    const { promptId } = createSaveListener(campaignName, {
        targetName,
        saveType: auto.saveType || 'CON',
        saveDc,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} triggered — ${targetName} must make ${auto.saveType || 'CON'} save (DC ${saveDc})`,
        promptId,
    }).catch((e) => { console.error("[reactionDamage] Error:", e); });

    const handleSaveResult = async (event) => {
        if (event.detail.promptId !== promptId) return;

        if (!event.detail.success && auto.damageExpression) {
            const damageResult = rollExpression(auto.damageExpression);
            if (damageResult) {
                addEntry(campaignName, {
                    type: 'roll',
                    characterName: playerStats.name,
                    rollType: 'damage',
                    name: action.name + ' Damage',
                    targetName,
                    damageType: auto.damageType || 'Necrotic',
                    total: damageResult.total,
                    formula: auto.damageExpression,
                    rolls: damageResult.rolls,
                    description: `${action.name} dealt ${damageResult.total} ${auto.damageType || 'Necrotic'} damage to ${targetName}.`,
                }).catch((e) => { console.error("[reactionDamage] Error:", e); });

                const cs = await getCombatContext(campaignName);
                if (cs) {
                    await applyDamageToTarget(cs, targetName, damageResult.total, [auto.damageType || 'Necrotic'], campaignName, characters, false, playerStats.name);
                } else {
                    console.error('[reactionDamage] No combat context — damage not applied:', { actionName: action.name, targetName });
                }
            }
        }

        if (!event.detail.success && auto.alsoInflicts) {
            const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
            const newEffects = [...storedEffects, {
                target: targetName,
                source: action.name,
                option: auto.alsoInflicts,
                effect: auto.alsoInflicts,
                duration: 'until_used',
            }];
            setRuntimeValue('campaign', 'targetEffects', newEffects, campaignName);
        }

        if (!event.detail.success) {
            const hasPhysiciansTouch = playerStats.specialActions?.some(f => f.name === "Physician's Touch");
            if (hasPhysiciansTouch) {
                const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
                const condArray = Array.isArray(conditions) ? conditions : [];
                if (!condArray.includes('poisoned')) {
                    setRuntimeValue(targetName, 'activeConditions', [...condArray, 'poisoned'], campaignName);
                }
            }
        }

        window.removeEventListener('save-result', handleSaveResult);
    };

    window.addEventListener('save-result', handleSaveResult);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            targetName,
            description: `${targetName} must make a ${auto.saveType || 'CON'} saving throw (DC ${saveDc}).`,
            automation: auto,
        },
    };
}

async function handleThoughtShield(action, playerStats, campaignName) {
    const warlockName = playerStats.name;

    // CLA-361: every gate refusal now writes a thought_shield_refused log line
    // (CLA-337 storms_thunder_refused shape) — popup-only refusals were the §7 gap.
    const tsRefuse = (description) => {
        addEntry(campaignName, {
            type: 'automation',
            characterName: warlockName,
            automationType: 'thought_shield_refused',
            name: action.name,
            description,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[thoughtShield] Error logging refusal:', e); });
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description,
            },
        };
    };

    const allFeatures = [
        ...(playerStats.characterAdvancement || []),
        ...(playerStats.reactions || []),
    ];
    const hasThoughtShield = allFeatures.some(f => f.name === 'Thought Shield');
    if (!hasThoughtShield) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${warlockName} does not have Thought Shield.`,
            },
        };
    }

    const cs = await getCombatContext(campaignName);
    if (!cs) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No combat context available.',
            },
        };
    }

    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    if (!lastAttack) {
        return tsRefuse('No recent attack found. Thought Shield requires a creature to have dealt psychic damage to you.');
    }

    // CLA-361: once-per-round reaction latch (CLA-335 recipe — round read from the
    // FRESH cs above, never a stale mirror). Checked BEFORE the lastAttack identity
    // gates because the persisted reflect below re-stamps lastAttack with the warlock
    // as attacker (CLA-337 caveat), so the latch is the authoritative guard that a
    // spent Reaction cannot refire — refuses spend nothing.
    const currentRound = cs.round || 1;
    const usedRound = Number(getRuntimeValue(warlockName, THOUGHT_SHIELD_ROUND_KEY, campaignName) ?? 0);
    if (usedRound === currentRound) {
        return tsRefuse(`You have already used ${action.name} this round — your Reaction is spent until your next turn.`);
    }

    if (lastAttack.targetName !== warlockName) {
        return tsRefuse(`You were not the target of the last attack (${lastAttack.targetName} was). Thought Shield only works when you take psychic damage.`);
    }

    if (!lastAttack.damageTypes?.some(d => d.toLowerCase() === 'psychic')) {
        return tsRefuse(`The last attack dealt ${lastAttack.damageTypes?.join(', ') || 'unknown'} damage, not psychic damage. Thought Shield only reflects psychic damage.`);
    }

    const actualWarlockDamage = lastAttack.actualDamage || lastAttack.rawDamage || 0;
    if (actualWarlockDamage <= 0) {
        return tsRefuse('The attacker dealt no damage to you (immune/resistant). Thought Shield reflects the damage you took, which was 0.');
    }

    const attackerCreatureName = lastAttack.attackerName;
    if (!attackerCreatureName) {
        return tsRefuse('No attacker found to reflect damage to.');
    }

    const attackerCreature = cs.creatures.find(c => c.name === attackerCreatureName);
    if (!attackerCreature) {
        return tsRefuse(`Attacker "${attackerCreatureName}" not found in combat.`);
    }

    if (attackerCreature.currentHp <= 0) {
        return tsRefuse(`${attackerCreatureName} is already defeated. Cannot reflect damage to a creature that's already down.`);
    }

    // CLA-361: range gate — the feature's data declares range 5_ft. Canonical
    // isWithinRange (CLA-337 recipe): strict token distances on a mapped rig,
    // lenient true when gridless/unpositioned.
    const rangeFt = rangeToFeet(action.automation?.range) ?? 5;
    const inRange = await isWithinRange(attackerCreatureName, warlockName, rangeFt);
    if (!inRange) {
        return tsRefuse(`${attackerCreatureName} is not within ${rangeFt} feet of you. Thought Shield requires the attacker to be within ${rangeFt} feet.`);
    }

    // Stamp the latch before applying so a thrown apply cannot leave the
    // Reaction refirable within the same round.
    await setRuntimeValue(warlockName, THOUGHT_SHIELD_ROUND_KEY, currentRound, campaignName);

    // CLA-361 FIX: persist through the verified applyDamageToTarget consumer
    // (CLA-337 Storm's Thunder pattern) — it writes combatSummary via storage.set
    // (monster currentHp), emits the hp_change log row, and handles the attacker's
    // concentration DC/save. The reflect amount is the post-resistance damage the
    // warlock actually took, so ignoreResistance=true ("same amount" — RAW).
    const reflectedDamage = actualWarlockDamage;
    const characters = cs.creatures.filter(c => c.type === 'player');
    const applyResult = await applyDamageToTarget(cs, attackerCreatureName, reflectedDamage, ['Psychic'], campaignName, characters, true, warlockName);

    if (!applyResult) {
        console.error('[thoughtShield] applyDamageToTarget failed — reflected damage not applied:', { warlockName, attackerCreatureName, reflectedDamage });
        return tsRefuse(`Reflected damage could not be applied to ${attackerCreatureName}.`);
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: warlockName,
        abilityName: action.name,
        description: `${warlockName} reflects ${reflectedDamage} psychic damage back to ${attackerCreatureName} using Thought Shield (${attackerCreatureName} at ${applyResult.newHp} HP).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[thoughtShield] Error logging:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${warlockName} reflects ${reflectedDamage} psychic damage back to ${attackerCreatureName}!`,
        },
    };
}

async function handleEnergyRedirection(action, playerStats, campaignName) {
    const playerName = playerStats.name;
    const auto = action.automation;

    const chosenTypes = getChosenResistanceTypes(playerName, campaignName);
    if (!chosenTypes || chosenTypes.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} requires you to have chosen damage types for Energy Resistances.`,
                automation: auto,
            },
        };
    }

    const cs = await getCombatContext(campaignName);
    if (!cs) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No combat context available.',
            },
        };
    }

    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    if (!lastAttack) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No recent attack found. Energy Redirection requires you to have taken damage of a type you've chosen resistance against.`,
            },
        };
    }

    if (lastAttack.targetName !== playerName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `You were not the target of the last attack (${lastAttack.targetName} was). Energy Redirection only works when you take damage.`,
            },
        };
    }

    const damageTypes = lastAttack.damageTypes || [];
    const matchingTypes = damageTypes.filter(dt =>
        chosenTypes.some(ct => ct.toLowerCase() === dt.toLowerCase())
    );
    if (matchingTypes.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `The last attack dealt ${damageTypes.join(', ') || 'unknown'} damage, not one of your chosen resistance types (${chosenTypes.join(', ')}).`,
            },
        };
    }

    const targets = cs.creatures
        .filter(c => c.name !== playerName)
        .map(c => {
            const hp = c.type === 'player'
                ? { currentHp: getRuntimeValue(c.name, 'currentHitPoints') ?? getRuntimeValue(c.name, 'hitPoints') ?? 0, maxHp: getRuntimeValue(c.name, 'hitPoints') ?? 0 }
                : { currentHp: c.currentHp ?? c.maxHp, maxHp: c.maxHp };
            return { ...c, ...hp };
        });

    if (targets.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: No other creatures available to redirect to.`,
                automation: auto,
            },
        };
    }

    const conBonus = getAbilityModifier(playerStats.abilities, 'CON');
    const prof = playerStats.proficiency || 0;
    const saveDc = 8 + conBonus + prof;

    return {
        type: 'modal',
        modalName: 'energyRedirection',
        payload: {
            title: `${action.name} — Redirect Energy`,
            targets,
            confirmLabel: 'Redirect',
            confirmIcon: 'fa-bolt',
            featureDescription: `Target must make a DEX saving throw (DC ${saveDc}) or take 2d12 + ${conBonus >= 0 ? '+' : ''}${conBonus} ${matchingTypes[0]} damage.`,
            description: `You redirect damage of the ${matchingTypes[0]} type toward another creature you can see within 60 feet.`,
            onTargetSelected: async (targetName) => {
                if (!targetName) return null;

                const evaluated = evaluateAutoExpression(auto.damageExpression, playerStats);
                const roll = rollExpression(evaluated);
                const redirectDamage = roll?.total ?? 0;

                const { promise } = createSaveListener(campaignName, {
                    targetName,
                    saveType: auto.saveType || 'DEX',
                    saveDc,
                });
                const saveResult = await promise;

                const damageOnSave = computeDamageAfterSave(redirectDamage, saveResult.success, null);
                if (damageOnSave > 0) {
                    const characters = getRuntimeValue('characters', 'characters', campaignName) || [];
                    await applyDamageToTarget(cs, targetName, damageOnSave, [matchingTypes[0]], campaignName, characters, false, playerName);
                }

                await addEntry(campaignName, {
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: action.name,
                    description: `${playerName} redirects ${matchingTypes[0]} energy to ${targetName}. ${targetName} ${saveResult.success ? 'succeeded' : 'failed'} their DEX save (DC ${saveDc}) and took ${damageOnSave} ${matchingTypes[0]} damage.`,
                    targetName,
                    timestamp: Date.now(),
                }).catch((e) => { console.error("[energyRedirection] Error:", e); });

                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: action.name,
                        targetName,
                        description: `${targetName} ${saveResult.success ? 'succeeded' : 'failed'} their DEX save (DC ${saveDc}) and took ${damageOnSave} ${matchingTypes[0]} damage.`,
                    },
                };
            },
            onSkip: async () => {
                await addEntry(campaignName, {
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: action.name,
                    description: `${playerName} chose not to redirect energy.`,
                }).catch((e) => { console.error("[energyRedirection] Skip:", e); });
            },
        },
    };
}
