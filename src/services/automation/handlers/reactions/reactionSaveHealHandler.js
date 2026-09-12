import { createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { sendDeathSavePrompt } from '../../../combat/conditions/savePromptService.js';
import utils from '../../../ui/utils.js';

function getRuntimeUsesKey(featureName) {
    return featureName.toLowerCase().replace(/\s+/g, '') + 'Uses';
}

function barbarianLevelOf(playerStats) {
    return playerStats.class?.class_levels?.find(cl => cl.name === 'Barbarian')?.level || playerStats.level || 1;
}

function evaluateHealExpression(expression, playerStats) {
    if (typeof expression === 'number') return expression;
    if (!expression) return playerStats.barbarianLevel || playerStats.level || 1;

    const match = String(expression).match(/2\s*\*\s*barbarian_level/i);
    if (match) {
        return 2 * barbarianLevelOf(playerStats);
    }

    const numericMatch = String(expression).match(/^(\d+)\s*\*\s*(\w+)$/);
    if (numericMatch) {
        const multiplier = parseInt(numericMatch[1], 10);
        const field = numericMatch[2].toLowerCase();
        let value = 0;
        if (field === 'barbarian_level') {
            value = barbarianLevelOf(playerStats);
        } else if (field === 'level') {
            value = playerStats.level || 1;
        }
        return multiplier * value;
    }

    return playerStats.level || 1;
}

function getPlayersLastKnownHp(cs, playerName, campaignName) {
    const playerCreature = cs.creatures?.find(c => c.name === playerName || c.name.startsWith(playerName + ' '));
    if (playerCreature?.type === 'player') {
        return getRuntimeValue(playerName, 'currentHitPoints', campaignName) ?? 0;
    }
    return playerCreature?.currentHp ?? 0;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Relentless Rage';
    const saveType = auto.saveType || 'CON';

    const rawBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(rawBuffs) ? rawBuffs : [];
    const rageActive = activeBuffs.some(b => b.name === 'Rage');
    if (!rageActive) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: 'Rage is not active. Relentless Rage requires an active Rage.',
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
                name: featureName,
                description: 'No combat active.',
                automation: auto,
            },
        };
    }

    const playerHp = getPlayersLastKnownHp(cs, playerName, campaignName);

    if (playerHp > 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${playerName} is not at 0 Hit Points.`,
                automation: auto,
            },
        };
    }

    const usesKey = getRuntimeUsesKey(featureName);
    const currentUses = Number(getRuntimeValue(playerName, usesKey) ?? 0);

    const maxUses = 1;

    if (currentUses >= maxUses) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} has no uses remaining. Recharges after a Short or Long Rest.`,
                automation: auto,
            },
        };
    }

    const baseDc = auto.saveDc || 10;
    const scaling = auto.dcScaling || 0;
    const saveDc = baseDc + (currentUses * scaling);

    const { promptId } = createSaveListener(campaignName, {
        targetName: playerName,
        saveType: saveType,
        saveDc,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${featureName} triggered — ${playerName} must make ${saveType} save (DC ${saveDc})`,
        source: featureName,
        promptId,
    }).catch((e) => { console.error("[reactionSaveHeal] Error:", e); });

    const handleSaveResult = async (event) => {
        if (event.detail.promptId !== promptId) return;

        const healAmount = evaluateHealExpression(auto.healExpression, playerStats);
        const saveRoll = event.detail.roll;
        const saveBonus = event.detail.saveBonus;
        const saveTotal = event.detail.total;

        if (event.detail.success) {
            await setRuntimeValue(playerName, 'currentHitPoints', healAmount, campaignName);

            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: featureName,
                description: `${playerName} succeeded on ${saveType} save. ${featureName} sets Hit Points to ${healAmount}.`,
                saveRoll,
                saveBonus,
                saveTotal,
                saveDc,
                saveSuccess: true,
                hpGained: healAmount,
                source: featureName,
            }).catch((e) => { console.error("[reactionSaveHeal] Error:", e); });

            window.dispatchEvent(new CustomEvent('combat-summary-updated'));
        } else {
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: featureName,
                description: `${playerName} failed ${saveType} save. ${featureName} did not activate.`,
                saveRoll,
                saveBonus,
                saveTotal,
                saveDc,
                saveSuccess: false,
                source: featureName,
            }).catch((e) => { console.error("[reactionSaveHeal] Error:", e); });

            const currentHp = getRuntimeValue(playerName, 'currentHitPoints', campaignName);
            if (currentHp != null && Number(currentHp) <= 0) {
                const deathSavePromptId = utils.guid();
                sendDeathSavePrompt(campaignName, {
                    promptId: deathSavePromptId,
                    targetName: playerName,
                });

                const handleDeathSaveResult = (deathEvent) => {
                    if (deathEvent.detail?.promptId !== deathSavePromptId) return;
                    window.removeEventListener('death-save-result', handleDeathSaveResult);

                    const dsResult = deathEvent.detail;
                    const currentSaves = getRuntimeValue(playerName, 'deathSaves', campaignName) || [false, false, false];
                    const currentFailures = getRuntimeValue(playerName, 'deathFailures', campaignName) || [false, false, false];

                    let newSaves = [...currentSaves];
                    let newFailures = [...currentFailures];

                    if (dsResult.isNat20) {
                        newSaves = [false, false, false];
                        newFailures = [false, false, false];
                        setRuntimeValue(playerName, 'currentHitPoints', 1, campaignName);
                    } else if (dsResult.success) {
                        const firstEmpty = newSaves.indexOf(false);
                        if (firstEmpty !== -1) newSaves[firstEmpty] = true;
                    } else {
                        const failMultiplier = dsResult.isNat1 ? 2 : 1;
                        for (let i = 0; i < failMultiplier; i++) {
                            const firstEmpty = newFailures.indexOf(false);
                            if (firstEmpty !== -1) newFailures[firstEmpty] = true;
                        }
                    }

                    setRuntimeValue(playerName, 'deathSaves', newSaves, campaignName);
                    setRuntimeValue(playerName, 'deathFailures', newFailures, campaignName);

                    addEntry(campaignName, {
                        type: 'death_save',
                        characterName: playerName,
                        roll: dsResult.roll,
                        isNatural20: dsResult.isNat20,
                        isNatural1: dsResult.isNat1,
                        success: dsResult.success || dsResult.result === 'nat20' || dsResult.result === 'stable',
                    }).catch((e) => { console.error("[reactionSaveHeal] Error:", e); });
                };

                window.addEventListener('death-save-result', handleDeathSaveResult);
            }
        }

        await setRuntimeValue(playerName, usesKey, currentUses + 1, campaignName);

        window.removeEventListener('save-result', handleSaveResult);
    };

    window.addEventListener('save-result', handleSaveResult);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            targetName: playerName,
            description: `${playerName} must make a ${saveType} saving throw (DC ${saveDc}).`,
            automation: auto,
        },
    };
}
