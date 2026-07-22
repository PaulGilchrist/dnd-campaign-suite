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

const POLEARM_WEAPONS = ['Quarterstaff', 'Spear'];

function hasPolearmWeapon(allEquipment, equippedWeapons) {
    if (!allEquipment || !equippedWeapons) return false;
    for (const equippedName of equippedWeapons) {
        let baseName = equippedName;
        if (equippedName && typeof equippedName === 'string' && equippedName.charAt(0) === '+') {
            baseName = equippedName.substring(3);
        }
        const weapon = allEquipment.find(item => item.name === baseName);
        if (!weapon) continue;
        if (POLEARM_WEAPONS.some(pw => weapon.name === pw)) return true;
        const props = weapon.properties || [];
        if (props.includes('Heavy') && props.includes('Reach')) return true;
    }
    return false;
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

export async function handle(action, playerStats, campaignName, mapName, allEquipment) {
    const auto = action.automation;

    if (auto?.trigger === 'psychic_damage_received') {
        return await handleThoughtShield(action, playerStats, campaignName);
    }

    if (auto?.trigger === 'creature_enters_reach_while_holding_polearm') {
        const hasWeapon = hasPolearmWeapon(allEquipment, playerStats.inventory?.equipped);
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
            }
        }

        if (!event.detail.success && auto.alsoInflicts) {
            const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
            storedEffects.push({
                target: targetName,
                source: action.name,
                option: auto.alsoInflicts,
                effect: auto.alsoInflicts,
                duration: 'until_used',
            });
            setRuntimeValue(campaignName, 'targetEffects', storedEffects, campaignName);
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

    const lastAttack = cs?.lastAttack;
    if (!lastAttack) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No recent attack found. Thought Shield requires a creature to have dealt psychic damage to you.`,
            },
        };
    }

    if (lastAttack.targetName !== warlockName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `You were not the target of the last attack (${lastAttack.targetName} was). Thought Shield only works when you take psychic damage.`,
            },
        };
    }

    if (!lastAttack.damageTypes?.some(d => d.toLowerCase() === 'psychic')) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `The last attack dealt ${lastAttack.damageTypes?.join(', ') || 'unknown'} damage, not psychic damage. Thought Shield only reflects psychic damage.`,
            },
        };
    }

    const actualWarlockDamage = lastAttack.actualDamage || lastAttack.rawDamage || 0;
    if (actualWarlockDamage <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `The attacker dealt no damage to you (immune/resistant). Thought Shield reflects the damage you took, which was 0.`,
            },
        };
    }

    const attackerCreatureName = lastAttack.attackerName;
    if (!attackerCreatureName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No attacker found to reflect damage to.',
            },
        };
    }

    const attackerCreature = cs.creatures.find(c => c.name === attackerCreatureName);
    if (!attackerCreature) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Attacker "${attackerCreatureName}" not found in combat.`,
            },
        };
    }

    if (attackerCreature.currentHp <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${attackerCreatureName} is already defeated. Cannot reflect damage to a creature that's already down.`,
            },
        };
    }

    const reflectedDamage = actualWarlockDamage;
    attackerCreature.currentHp = Math.max(0, attackerCreature.currentHp - reflectedDamage);

    await addEntry(campaignName, {
        type: 'hp_change',
        targetName: attackerCreatureName,
        delta: -reflectedDamage,
        currentHp: attackerCreature.currentHp,
        maxHp: attackerCreature.maxHp,
        isHealing: false,
        isUnconscious: attackerCreature.currentHp <= 0,
        abilityName: action.name,
    }).catch((e) => { console.error("[thoughtShield] Error logging:", e); });

    if (attackerCreature.concentration && reflectedDamage > 0) {
        attackerCreature.concentration.dc = Math.max(10, Math.floor(reflectedDamage / 2));
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: warlockName,
        abilityName: action.name,
        description: `${warlockName} reflects ${reflectedDamage} psychic damage back to ${attackerCreatureName} using Thought Shield.`,
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

    const lastAttack = cs?.lastAttack;
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
