import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import { executeHandler } from '../../automation/index.js';

function usesSpellSlot(spell, metaCtx) {
    return metaCtx?.slotLevel > 0 || spell.level > 0;
}

function isSorcererSpell(spell, playerStats) {
    const casterClass = playerStats?.class?.name;
    if (casterClass === 'Sorcerer') return true;
    if (spell.classes && spell.classes.includes('Sorcerer')) return true;
    return false;
}

export function getWildMagicSurgeFeatures(playerStats) {
    const passives = playerStats.automation?.passives || [];
    return passives.filter(p => p.type === 'wild_magic_surge');
}

export function hasWildMagicSurge(playerStats) {
    return getWildMagicSurgeFeatures(playerStats).length > 0;
}

export function getControlledChaosFeature(playerStats) {
    const passives = playerStats.automation?.passives || [];
    return passives.find(p => p.type === 'auto_effect' && p.effect === 'wild_magic_double_roll');
}

export function getTamedSurgeFeature(playerStats) {
    const passives = playerStats.automation?.passives || [];
    return passives.find(p => p.type === 'wild_magic_tamed');
}

export function getFeatsOfChaosFeature(playerStats) {
    const passives = playerStats.automation?.passives || [];
    return passives.find(p => p.type === 'conditional_advantage' && p.condition === 'feats_of_chaos_active');
}

export async function triggerWildMagicSurge(spell, metaCtx, playerStats, campaignName, mapName) {
    if (!isSorcererSpell(spell, playerStats)) {
        return null;
    }

    if (!usesSpellSlot(spell, metaCtx)) {
        return null;
    }

    const surgeFeatures = getWildMagicSurgeFeatures(playerStats);
    if (surgeFeatures.length === 0) {
        return null;
    }

    const controlledChaos = getControlledChaosFeature(playerStats);
    if (controlledChaos) {
        await setRuntimeValue(playerStats.name, 'wildMagicDoubleRoll', true, campaignName, true);
    }

    const tamedSurge = getTamedSurgeFeature(playerStats);
    if (tamedSurge) {
        const usesKey = 'tamedSurgeUses';
        const restKey = 'tamedSurgeLastRest';
        const storedUses = getRuntimeValue(playerStats.name, usesKey, campaignName);
        const restTimestamp = getRuntimeValue(playerStats.name, restKey, campaignName);
        const now = Date.now();

        let currentUses = 1;
        if (restTimestamp && now - restTimestamp < 86400000) {
            currentUses = Number(storedUses ?? 1);
        } else if (!restTimestamp) {
            currentUses = Number(storedUses ?? 1);
        }

        if (currentUses > 0) {
            const surgeTable = playerStats.wildMagicSurgeTable || [];
            const availableSurges = surgeTable.filter(e => e.max < 20);
            if (availableSurges.length > 0) {
                return {
                    type: 'modal',
                    modalName: 'wildMagicTamed',
                    payload: {
                        featureName: tamedSurge.name,
                        availableSurges,
                        playerStats,
                        campaignName,
                    },
                };
            }
        }
    }

    const featsOfChaos = getFeatsOfChaosFeature(playerStats);
    const featsOfChaosActive = getRuntimeValue(playerStats.name, 'featsOfChaosActive', campaignName) === true;

    if (featsOfChaos) {
        const usesKey = 'featsOfChaosUses';
        const restKey = 'featsOfChaosLastRest';
        const storedUses = getRuntimeValue(playerStats.name, usesKey, campaignName);
        const restTimestamp = getRuntimeValue(playerStats.name, restKey, campaignName);
        const now = Date.now();

        let currentUses = 1;
        if (restTimestamp && now - restTimestamp < 86400000) {
            currentUses = Number(storedUses ?? 1);
        } else if (!restTimestamp) {
            currentUses = Number(storedUses ?? 1);
        }

        if (currentUses <= 0) {
            const lastRest = restTimestamp || 0;
            const timeSinceRest = now - lastRest;
            if (timeSinceRest >= 86400000) {
                currentUses = 1;
            } else {
                currentUses = 0;
            }
        }

        if (currentUses > 0) {
            const newUses = currentUses - 1;
            await setRuntimeValue(playerStats.name, usesKey, newUses, campaignName, true);
            if (newUses <= 0) {
                await setRuntimeValue(playerStats.name, restKey, now, campaignName, true);
            }

            if (featsOfChaosActive) {
                await setRuntimeValue(playerStats.name, 'featsOfChaosActive', false, campaignName, true);
            } else {
                await setRuntimeValue(playerStats.name, 'featsOfChaosActive', true, campaignName, true);
            }

            const surgeTable = playerStats.wildMagicSurgeTable || [];
            const d20Roll = Math.floor(Math.random() * 20) + 1;
            const surgeEntry = surgeTable.find(e => d20Roll >= e.min && d20Roll <= e.max);
            const effectText = surgeEntry ? surgeEntry.effect : 'Unknown Wild Magic effect.';
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featsOfChaos.name,
                    description: `<b>${featsOfChaos.name}: Advantage granted, Wild Magic Surge triggered!</b><br/>Rolled ${d20Roll}: ${effectText}`,
                    automation: featsOfChaos,
                },
            };
        }
    }

    const surgeFeature = surgeFeatures[0];
    const usesKey = `wildMagicSurgeTriggered`;
    const lastTrigger = getRuntimeValue(playerStats.name, usesKey, campaignName);
    const now = Date.now();

    if (lastTrigger && now - lastTrigger < 60000) {
        return null;
    }

    const action = {
        name: surgeFeature.name,
        automation: {
            type: 'wild_magic_surge',
            trigger: 'after_sorcerer_spell_slot',
            oncePerTurn: surgeFeature.oncePerTurn || false,
        },
        wildMagicSurgeTable: playerStats.wildMagicSurgeTable || [],
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        if (result) {
            await setRuntimeValue(playerStats.name, usesKey, now, campaignName, true);
            return result;
        }
    } catch (e) {
        console.error(`[wildMagicSurge] Failed to execute surge for ${surgeFeature.name}:`, e);
    }

    return null;
}
