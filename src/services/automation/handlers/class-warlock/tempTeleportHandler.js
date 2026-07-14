import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { addEntry } from '../../../ui/logService.js';

function getAvailableSpellSlotLevel(playerStats) {
    for (let lvl = 2; lvl <= 9; lvl++) {
        const key = `spell_slots_level_${lvl}`;
        const max = playerStats.spellAbilities?.[key] || 0;
        const current = getRuntimeValue(playerStats.name, key, null);
        const available = current != null ? Math.min(max, Number(current)) : max;
        if (available > 0) {
            return lvl;
        }
    }
    return null;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action?.automation || {};

    if (auto?.effect === 'moonlight_step_teleport') {
        const usesKey = 'moonlightStepUses';
        const usesMax = evaluateAutoExpression('WIS modifier', playerStats);
        const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);
        if (currentUses <= 0) {
            const slotLevel = getAvailableSpellSlotLevel(playerStats);
            if (slotLevel !== null) {
                return {
                    type: 'modal',
                    modalName: 'moonlightStepFallback',
                    payload: {
                        action,
                        playerStats,
                        campaignName,
                        slotLevel,
                    },
                };
            }
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `${action.name} has no uses remaining. Recharges on a Long Rest.`,
                    automation: auto,
                },
            };
        }
    }

    return {
        type: 'modal',
        modalName: 'teleport',
        payload: { action, playerStats, campaignName },
    };
}

export async function confirmTeleport(action, playerStats, campaignName, useExtended, consumedSlotLevel) {
    const auto = action?.automation || {};
    const playerName = playerStats.name;

    if (consumedSlotLevel) {
        const slotKey = `spell_slots_level_${consumedSlotLevel}`;
        const current = getRuntimeValue(playerName, slotKey, campaignName);
        const max = playerStats.spellAbilities?.[slotKey] || 0;
        const available = current != null ? Math.min(max, Number(current)) : max;
        if (available > 0) {
            setRuntimeValue(playerName, slotKey, available - 1, campaignName);
        }
    }

    const distance = useExtended
        ? (auto.extendedDistance || '150 ft')
        : (auto.distance || '60 ft');

    if (useExtended) {
        setRuntimeValue(playerName, '_teleportExtendedUsed', true, campaignName);
    }

    let description;
    if (auto.effect === 'teleport_swap_with_illusion') {
        description = `${action.name}: Swapped places with your illusion.`;
    } else {
        description = `${action.name}: Teleported ${distance} to an unoccupied space you can see.`;
        if (useExtended && auto.bringAllies && auto.allyCount > 0) {
            description += ` Also brought up to ${auto.allyCount} willing creatures within ${auto.teleportRange || '10 ft'} of your destination.`;
        }
    }

    if (auto.effect === 'shadow_step_teleport' || auto.effect === 'moonlight_step_teleport') {
        let logDescription = `${playerName} used ${action.name} to teleport ${distance}. Gains Advantage on next attack roll.`;
        if (consumedSlotLevel) {
            logDescription += ` Expend a level ${consumedSlotLevel} spell slot.`;
        }
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: logDescription,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[tempTeleport] Error logging:", e); });

        const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
        const newEffect = {
            target: playerName,
            source: action.name,
            effect: 'next_attack_advantage',
            value: null,
            duration: 'until_end_of_turn',
        };
        setRuntimeValue(campaignName, 'targetEffects', [...storedEffects, newEffect], campaignName);

        if (auto.effect === 'moonlight_step_teleport') {
            const usesKey = 'moonlightStepUses';
            const usesMax = evaluateAutoExpression('WIS modifier', playerStats);
            const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? usesMax);
            if (currentUses > 0) {
                setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);
            }
        }

        if (auto.effect === 'shadow_step_teleport') {
            const improvedStep = playerStats.automation?.passives?.find(f => f.name === 'Improved Shadow Step');
            if (improvedStep) {
                const targetInfo = await resolveTarget(campaignName, playerStats.name);
                const targetName = targetInfo?.target?.name || 'Unknown';

                const currentEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                const perceptionEffect = {
                    target: targetName,
                    source: 'Improved Shadow Step',
                    effect: 'disadvantage_perception_checks',
                    value: null,
                    duration: 'until_start_of_next_turn',
                };
                setRuntimeValue(campaignName, 'targetEffects', [...currentEffects, perceptionEffect], campaignName);

                const saveDc = buildSaveDc({ saveDc: 'ability', saveAbility: 'WIS' }, playerStats);
                const { promptId } = createSaveListener(campaignName, {
                    targetName,
                    saveType: 'WIS',
                    saveDc,
                });

                const handleSaveResult = (event) => {
                    if (event.detail.promptId !== promptId) return;
                    if (!event.detail.success) {
                        const storedConds = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
                        const newConds = Array.isArray(storedConds) ? [...storedConds, 'blinded'] : ['blinded'];
                        setRuntimeValue(targetName, 'activeConditions', newConds, campaignName);
                    }
                    window.removeEventListener('save-result', handleSaveResult);
                };
                window.addEventListener('save-result', handleSaveResult);

                description += ` Improved Shadow Step: ${targetName} has perception disadvantage and must make a WIS save (DC ${saveDc}) or be Blinded.`;
            }
        }

        if (auto.effect === 'moonlight_step_teleport') {
            const lunarForm = playerStats.automation?.passives?.find(f => f.name === 'Lunar Form');
            if (lunarForm) {
                const targetInfo = await resolveTarget(campaignName, playerStats.name);
                const targetName = targetInfo?.target?.name || null;

                if (targetName) {
                    const currentEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                    const allyEffect = {
                        target: targetName,
                        source: 'Shared Moonlight',
                        effect: 'next_attack_advantage',
                        value: null,
                        duration: 'until_end_of_turn',
                    };
                    setRuntimeValue(campaignName, 'targetEffects', [...currentEffects, allyEffect], campaignName);
                    description += ` Shared Moonlight: ${targetName} also gains Advantage on their next attack roll.`;
                }
            }
        }
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description,
            automation: auto,
        },
    };
}

export function clearExtendedFlag(playerName, campaignName) {
    setRuntimeValue(playerName, '_teleportExtendedUsed', false, campaignName);
}

export function isExtendedAvailable(playerName, campaignName) {
    return !getRuntimeValue(playerName, '_teleportExtendedUsed', campaignName);
}
