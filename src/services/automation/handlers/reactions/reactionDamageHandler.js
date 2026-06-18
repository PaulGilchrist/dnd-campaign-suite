import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { MELEE_REACH_FEET } from '../../../combat/baseCombatActions.js';

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
    const stored = getRuntimeValue(playerName, '_Boon_Of_Energy_Resistance_chosenTypes', campaignName);
    return Array.isArray(stored) ? stored : [];
}

function getRuntimeUsesKey(featureName) {
    return featureName.toLowerCase().replace(/\s+/g, '') + 'Uses';
}

async function consumeResourceCost(auto, playerStats, campaignName, actionName) {
    if (auto.resourceCost === 'focus_point') {
        const isHandOfHarm = actionName === 'Hand of Harm';
        const hasFlurryHealingHarm = playerStats.characterAdvancement?.some(f => f.name === "Flurry of Healing and Harm");
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
        const chosenTypes = getChosenResistanceTypes(playerStats.name, campaignName);
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
    }

    if (!auto.saveType) {
        const cs = await getCombatContext(campaignName);
        const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
        const targetName = target?.name || null;

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
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    const handleSaveResult = async (event) => {
        if (event.detail.promptId !== promptId) return;

        if (!event.detail.success && auto.damageExpression) {
            const damageResult = rollExpression(auto.damageExpression);
            if (damageResult) {
                addEntry(campaignName, {
                    type: 'damage_roll',
                    characterName: playerStats.name,
                    targetName,
                    damageType: auto.damageType || 'Necrotic',
                    total: damageResult.total,
                    formula: auto.damageExpression,
                    description: `${action.name} dealt ${damageResult.total} ${auto.damageType || 'Necrotic'} damage to ${targetName}.`,
                }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });
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
            const hasPhysiciansTouch = playerStats.characterAdvancement?.some(f => f.name === "Physician's Touch");
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
