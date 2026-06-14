import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getLastAttackRoll, getLastAbilityCheck, getLastSaveRoll } from '../../../hooks/useMetamagic.js';
import { automationInfoPopup } from '../../shared/popupResponse.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';
import { getDistanceFeet, rangeToFeet } from '../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../common/targetResolver.js';
import { getClassFeatures } from '../../../services/character/classFeatures.js';
import { evaluateAutoExpression } from '../../combat/automationService.js';

const EVENT_STALENESS_MS = 60000;

function isStale(event) {
    if (!event?.timestamp) return true;
    return (Date.now() - event.timestamp) > EVENT_STALENESS_MS;
}

function buildAttackRollDescription(action, attackerName, bonus, attackEvent) {
    const { d20, bonus: atkBonus, targetAc, hit, effectiveAc } = attackEvent;
    const ac = effectiveAc ?? targetAc;
    const modifiedD20 = d20 + bonus;
    const modifiedTotal = modifiedD20 + atkBonus;
    const modifiedHit = ac != null ? (modifiedD20 + atkBonus >= ac) : null;

    let description = `<b>${action.name}</b><br/>`;
    if (attackerName) {
        description += `Attacker: ${attackerName}<br/>`;
    }
    description += `Bonus: +${bonus}<br/>`;
    description += `Attack roll: d20(${d20}) + ${atkBonus} = ${d20 + atkBonus} vs AC ${ac != null ? ac : '—'} → <b>${hit ? 'HIT' : 'MISS'}</b><br/>`;
    description += `Modified: d20(${modifiedD20}) + ${atkBonus} = ${modifiedTotal} vs AC ${ac != null ? ac : '—'} → <b>${modifiedHit == null ? 'N/A' : modifiedHit ? 'HIT' : 'MISS'}</b><br/>`;

    if (hit === true) {
        description += `<br/><i>Attack already hit — no effect.</i>`;
    } else if (hit === false && modifiedHit === true) {
        description += `<br/><i>Miss turned into a hit!</i>`;
    } else if (hit === false && modifiedHit === false) {
        description += `<br/><i>Still a miss.</i>`;
    }

    return description;
}

function handleAttackRoll(action, playerStats, campaignName, bonus, attackerName) {
    const auto = action.automation;

    const targetName = attackerName || playerStats.name;
    const attackEvent = getLastAttackRoll(targetName);
    if (!attackEvent || isStale(attackEvent)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No recent attack roll found for ${targetName}. This feature can only be used shortly after an attack roll.`,
                automation: auto,
            },
        };
    }

    const description = buildAttackRollDescription(action, attackerName, bonus, attackEvent);

    return {
        type: 'popup',
        payload: { type: 'automation_info', name: action.name, description, automation: auto },
    };
}

function handleAbilityCheck(action, playerStats, _campaignName, bonus, creatureName) {
    const auto = action.automation;

    const targetName = creatureName || playerStats.name;
    const checkEvent = getLastAbilityCheck(targetName);
    if (!checkEvent || isStale(checkEvent)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No recent ability check found for ${targetName}. This feature can only be used shortly after an ability check.`,
                automation: auto,
            },
        };
    }

    const { d20, bonus: checkBonus, checkName } = checkEvent;
    const originalTotal = d20 + checkBonus;
    const modifiedD20 = d20 + bonus;
    const modifiedTotal = modifiedD20 + checkBonus;

    const description = `<b>${action.name}</b><br/>` +
        `Bonus: +${bonus}<br/>` +
        `${checkName}: d20(${d20}) + ${checkBonus} = ${originalTotal}` +
        ` → Modified: d20(${modifiedD20}) + ${checkBonus} = <b>${modifiedTotal}</b>`;

    return {
        type: 'popup',
        payload: { type: 'automation_info', name: action.name, description, automation: auto },
    };
}

function handleSaveRoll(action, playerStats, campaignName, bonus) {
    const auto = action.automation;
    const targetName = playerStats.name;
    const saveEvent = getLastSaveRoll(targetName);
    if (!saveEvent || isStale(saveEvent)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No recent saving throw found for ${targetName}. This feature can only be used shortly after a saving throw.`,
                automation: auto,
            },
        };
    }

    const { d20, bonus: saveBonus, saveType } = saveEvent;
    const originalTotal = d20 + saveBonus;
    const modifiedD20 = d20 + bonus;
    const modifiedTotal = modifiedD20 + saveBonus;

    const saveLabel = saveType ? saveType.toUpperCase() : 'Save';
    const description = `<b>${action.name}</b><br/>` +
        `Bonus: +${bonus}<br/>` +
        `${saveLabel}: d20(${d20}) + ${saveBonus} = ${originalTotal}` +
        ` → Modified: d20(${modifiedD20}) + ${saveBonus} = <b>${modifiedTotal}</b>`;

    return {
        type: 'popup',
        payload: { type: 'automation_info', name: action.name, description, automation: auto },
    };
}

async function consumeResourceCost(auto, playerStats, campaignName) {
    if (auto.resourceCost === 'channel_divinity') {
        const storedCharges = getRuntimeValue(playerStats.name, 'channelDivinityCharges');
        const classLevel = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1];
        const maxCharges = classLevel?.channel_divinity || classLevel?.class_specific?.channel_divinity_charges || 2;
        const currentCharges = storedCharges != null ? Number(storedCharges) : maxCharges;

        if (currentCharges <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: playerStats.name,
                    description: 'No Channel Divinity charges remaining.',
                    automation: auto,
                },
            };
        }

        await setRuntimeValue(playerStats.name, 'channelDivinityCharges', currentCharges - 1, campaignName);
    }
    else if (auto.resourceCost === 'focus_points') {
        const classLevel = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1];
        const maxFocus = classLevel?.focus_points || getClassFeatures(playerStats)?.maxFocusPoints || 0;
        const currentFocus = Number(getRuntimeValue(playerStats.name, 'focusPoints', campaignName) ?? maxFocus);

        if (currentFocus <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: playerStats.name,
                    description: 'No Focus Points remaining.',
                    automation: auto,
                },
            };
        }

        await setRuntimeValue(playerStats.name, 'focusPoints', currentFocus - 1, campaignName);
    }
    return null;
}

async function findAllyMissedAttack(playerStats, campaignName, mapName, rangeFt) {
    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary?.creatures) return null;

    const playerName = playerStats.name;
    for (const creature of combatSummary.creatures) {
        if (creature.name === playerName) continue;
        const attackEvent = getLastAttackRoll(creature.name);
        if (!attackEvent || isStale(attackEvent) || attackEvent.hit !== false) continue;

        if (mapName && rangeFt != null) {
            const positions = await resolveMapPositions(campaignName, mapName, playerName);
            if (positions?.attackerPos && positions?.targetPos) {
                const dist = getDistanceFeet(positions.attackerPos, positions.targetPos);
                if (dist != null && dist > rangeFt) continue;
            }
        }

        return { name: creature.name, attackEvent };
    }
    return null;
}

function getBardicDieSize(playerStats) {
    if (!playerStats.class?.class_levels) return 0;
    const classLevel = playerStats.class.class_levels.find(cl => cl.level === playerStats.level);
    return classLevel?.bardic_die || 0;
}

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    if (auto.target === 'saving_throw') {
        const costError = await consumeResourceCost(auto, playerStats, campaignName);
        if (costError) return costError;

        const saveEvent = getLastSaveRoll(playerName);
        const saveFresh = saveEvent && !isStale(saveEvent);

        if (!saveFresh) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `No recent saving throw found for ${playerName}. This feature can only be used shortly after a saving throw.`,
                    automation: auto,
                },
            };
        }

        const result = handleSaveRoll(action, playerStats, campaignName, 0);

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} used ${action.name} to reroll a saving throw.`,
            timestamp: Date.now(),
        }).catch(() => {});

        return result;
    }

    const bardicDieSize = getBardicDieSize(playerStats);

    if (bardicDieSize > 0 && auto.bonusExpression === 'bardic_inspiration_die') {
        const usesMax = playerStats?.class?.class_levels?.[(playerStats.level || 1) - 1]?.bardic_inspiration_uses
            ?? (playerStats.proficiency || 0);

        if (usesMax > 0) {
            const currentUses = Number(getRuntimeValue(playerName, 'bardicInspirationUses', campaignName) ?? usesMax);
            if (currentUses <= 0) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: action.name,
                        description: `${action.name} has no uses remaining. Recharges on a Long Rest.`,
                        automation: auto,
                    },
                };
            }
        }

        const biDieRoll = Math.floor(Math.random() * bardicDieSize) + 1;

        const attackEvent = getLastAttackRoll(playerName);
        const abilityEvent = getLastAbilityCheck(playerName);

        const attackFresh = attackEvent && !isStale(attackEvent) && attackEvent.hit === false;
        const abilityFresh = abilityEvent && !isStale(abilityEvent);

        if (!attackFresh && !abilityFresh) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `No recent failed ability check or attack roll found. ${action.name} can only be used shortly after a failure.`,
                    automation: auto,
                },
            };
        }

        let result;
        if (attackFresh) {
            result = handleAttackRoll(action, playerStats, campaignName, biDieRoll);
        } else {
            result = handleAbilityCheck(action, playerStats, campaignName, biDieRoll);
        }

        if (usesMax > 0) {
            const currentUses = Number(getRuntimeValue(playerName, 'bardicInspirationUses', campaignName) ?? usesMax);
            await setRuntimeValue(playerName, 'bardicInspirationUses', currentUses - 1, campaignName);
        }

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} used ${action.name}: rolled 1d${bardicDieSize} (${biDieRoll}).`,
            biDieRoll,
            biDieSize: bardicDieSize,
            timestamp: Date.now(),
        }).catch(() => {});

        return result;
    }

    if (auto.bonusExpression === 'psionic_energy_die') {
        const usesKey = 'psionicEnergy';
        const defaultMax = playerStats.resources?.[usesKey]?.max || 6;
        const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? defaultMax);

        if (currentUses <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name}: No Psionic Energy remaining. Recharges on a Short or Long Rest.`,
                    automation: auto,
                },
            };
        }

        const psionicDieSize = evaluateAutoExpression('psionic_energy_die', playerStats);
        const dieRoll = Math.floor(Math.random() * psionicDieSize) + 1;

        const attackEvent = getLastAttackRoll(playerName);
        const abilityEvent = getLastAbilityCheck(playerName);

        const attackFresh = attackEvent && !isStale(attackEvent) && attackEvent.hit === false;
        const abilityFresh = abilityEvent && !isStale(abilityEvent);

        if (!attackFresh && !abilityFresh) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `No recent failed ability check or attack roll found. ${action.name} can only be used shortly after a failure.`,
                    automation: auto,
                },
            };
        }

        let result;
        if (attackFresh) {
            result = handleAttackRoll(action, playerStats, campaignName, dieRoll);
        } else {
            result = handleAbilityCheck(action, playerStats, campaignName, dieRoll);
        }

        await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} used ${action.name}: rolled 1d${psionicDieSize} (${dieRoll}) to failed attack roll. Psionic Energy: ${currentUses - 1}/${defaultMax}.`,
            timestamp: Date.now(),
        }).catch(() => {});

        return result;
    }

    if (auto.bonus != null) {
        const bonus = Number(auto.bonus);

        const costError = await consumeResourceCost(auto, playerStats, campaignName);
        if (costError) return costError;

        const attackEvent = getLastAttackRoll(playerName);
        const abilityEvent = getLastAbilityCheck(playerName);

        const attackFresh = attackEvent && !isStale(attackEvent) && attackEvent.hit === false;
        const abilityFresh = abilityEvent && !isStale(abilityEvent);

        if (attackFresh) {
            const result = handleAttackRoll(action, playerStats, campaignName, bonus);
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: action.name,
                description: `${playerName} used ${action.name}: +${bonus} to own failed attack roll.`,
                timestamp: Date.now(),
            }).catch(() => {});
            return result;
        }
        if (abilityFresh) {
            const result = handleAbilityCheck(action, playerStats, campaignName, bonus);
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: action.name,
                description: `${playerName} used ${action.name}: +${bonus} to own failed ability check.`,
                timestamp: Date.now(),
            }).catch(() => {});
            return result;
        }

        if (auto.range) {
            const rangeFt = rangeToFeet(auto.range);
            const ally = await findAllyMissedAttack(playerStats, campaignName, mapName, rangeFt);
            if (ally) {
                const result = handleAttackRoll(action, playerStats, campaignName, bonus, ally.name);
                addEntry(campaignName, {
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: action.name,
                    description: `${playerName} used ${action.name}: +${bonus} to ${ally.name}'s failed attack roll.`,
                    targetName: ally.name,
                    timestamp: Date.now(),
                }).catch(() => {});
                return result;
            }
        }

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No recent failed attack roll or ability check found for you or any ally within range.',
                automation: auto,
            },
        };
    }

    return automationInfoPopup(action);
}
