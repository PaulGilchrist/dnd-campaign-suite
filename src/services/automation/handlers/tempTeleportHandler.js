import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { buildSaveDc, createSaveListener } from '../common/savePrompt.js';
import { resolveTarget } from '../common/targetResolver.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    return {
        type: 'modal',
        modalName: 'teleport',
        payload: { action, playerStats, campaignName },
    };
}

export async function confirmTeleport(action, playerStats, campaignName, useExtended) {
    const auto = action.automation;
    const playerName = playerStats.name;

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

    if (auto.effect === 'shadow_step_teleport') {
        const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
        const newEffect = {
            target: playerName,
            source: action.name,
            effect: 'next_attack_advantage',
            value: null,
            duration: 'until_end_of_turn',
        };
        setRuntimeValue(campaignName, 'targetEffects', [...storedEffects, newEffect], campaignName);

        const allFeatures = playerStats.allFeatures || [];
        const improvedStep = allFeatures.find(f => f.name === 'Improved Shadow Step');
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
