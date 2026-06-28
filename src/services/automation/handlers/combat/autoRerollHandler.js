import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { automationInfoPopup } from '../../../shared/popupResponse.js';
import { infoPopup } from '../../common/infoPopup.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getDistanceFeet, rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { getClassFeatures } from '../../../../services/character/classFeatures.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { getCurrentCombatRound } from '../../../../services/encounters/combatData.js';

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

function handleAttackRoll(action, bonus, lastAttack) {
    const auto = action.automation;
    if (!lastAttack || lastAttack.rollType !== 'attack') {
        return infoPopup(action.name, `No recent attack roll found. This feature can only be used shortly after an attack roll.`, auto);
    }

    const description = buildAttackRollDescription(action, null, bonus, lastAttack);

    return infoPopup(action.name, description, auto);
}

function handleAbilityCheck(action, bonus, lastAttack) {
    const auto = action.automation;
    const isCheck = lastAttack?.rollType === 'check' || lastAttack?.rollType === 'skill';
    if (!isCheck) {
        return infoPopup(action.name, `No recent ability check found. This feature can only be used shortly after an ability check.`, auto);
    }

    const { d20, bonus: checkBonus, checkName } = lastAttack;
    const originalTotal = d20 + checkBonus;
    const modifiedD20 = d20 + bonus;
    const modifiedTotal = modifiedD20 + checkBonus;

    const description = `<b>${action.name}</b><br/>` +
        `Bonus: +${bonus}<br/>` +
        `${checkName}: d20(${d20}) + ${checkBonus} = ${originalTotal}` +
        ` → Modified: d20(${modifiedD20}) + ${checkBonus} = <b>${modifiedTotal}</b>`;

    return infoPopup(action.name, description, auto);
}

function handleSaveRoll(action, bonus, lastAttack) {
    const auto = action.automation;
    if (!lastAttack || lastAttack.rollType !== 'save') {
        return infoPopup(action.name, `No recent saving throw found. This feature can only be used shortly after a saving throw.`, auto);
    }

    const { d20, bonus: saveBonus, saveType } = lastAttack;
    const originalTotal = d20 + saveBonus;
    const modifiedD20 = d20 + bonus;
    const modifiedTotal = modifiedD20 + saveBonus;

    const saveLabel = saveType ? saveType.toUpperCase() : 'Save';
    const description = `<b>${action.name}</b><br/>` +
        `Bonus: +${bonus}<br/>` +
        `${saveLabel}: d20(${d20}) + ${saveBonus} = ${originalTotal}` +
        ` → Modified: d20(${modifiedD20}) + ${saveBonus} = <b>${modifiedTotal}</b>`;

    return infoPopup(action.name, description, auto);
}

async function consumeResourceCost(auto, playerStats, campaignName) {
    if (auto.resourceCost === 'channel_divinity') {
        const storedCharges = getRuntimeValue(playerStats.name, 'channelDivinityCharges');
        const classLevel = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1];
        const maxCharges = classLevel?.channel_divinity || classLevel?.class_specific?.channel_divinity_charges || 2;
        const currentCharges = storedCharges != null ? Number(storedCharges) : maxCharges;

        if (currentCharges <= 0) {
            return infoPopup(playerStats.name, 'No Channel Divinity charges remaining.', auto);
        }

        await setRuntimeValue(playerStats.name, 'channelDivinityCharges', currentCharges - 1, campaignName);
    }
    else if (auto.resourceCost === 'focus_points') {
        const classLevel = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1];
        const maxFocus = classLevel?.focus_points || getClassFeatures(playerStats)?.maxFocusPoints || 0;
        const currentFocus = Number(getRuntimeValue(playerStats.name, 'focusPoints', campaignName) ?? maxFocus);

        if (currentFocus <= 0) {
            return infoPopup(playerStats.name, 'No Focus Points remaining.', auto);
        }

        await setRuntimeValue(playerStats.name, 'focusPoints', currentFocus - 1, campaignName);
    }
    return null;
}

async function findAllyMissedAttack(playerStats, campaignName, mapName, rangeFt) {
    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary?.lastAttack) return null;

    const lastAttack = combatSummary.lastAttack;
    if (lastAttack.rollType !== 'attack' || lastAttack.hit !== false) return null;
    if (lastAttack.attackerName === playerStats.name) return null;

    if (mapName && rangeFt != null) {
        const positions = await resolveMapPositions(campaignName, mapName, playerStats.name);
        if (positions?.attackerPos && positions?.targetPos) {
            const dist = getDistanceFeet(positions.attackerPos, positions.targetPos);
            if (dist != null && dist > rangeFt) return null;
        }
    }

    return { name: lastAttack.attackerName, attackEvent: lastAttack };
}

function getBardicDieSize(playerStats) {
    if (!playerStats.class?.class_levels) return 0;
    const classLevel = playerStats.class.class_levels.find(cl => cl.level === playerStats.level);
    return classLevel?.bardic_die || 0;
}

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const cs = await getCombatContext(campaignName);
    const lastAttack = cs?.lastAttack || null;

    if (auto.target === 'saving_throw') {
        if (auto.effect === 'override_fail_to_success' && auto.oncePer) {
            const trackingKey = `_guardedMind_usedRest`;
            const usedRest = getRuntimeValue(playerName, trackingKey, campaignName);
            if (usedRest === 'rest') {
                return infoPopup(action.name, `${action.name} can only be used once per Short or Long Rest.`, auto);
            }

            const isSave = lastAttack?.rollType === 'save';
            const isPlayerSave = lastAttack?.targetName === playerName;

            if (!isSave || !isPlayerSave) {
                return infoPopup(action.name, `No recent saving throw found for ${playerName}. This feature can only be used shortly after a saving throw.`, auto);
            }

            const { saveType } = lastAttack;
            const validAbilities = ['Intelligence', 'Wisdom', 'Charisma'];
            const abbr = saveType ? saveType.substring(0, 3).toUpperCase() : '';
            const abilityAbbrMap = { INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma' };
            const isValidSave = validAbilities.includes(saveType) || Object.keys(abilityAbbrMap).includes(abbr);

            if (!isValidSave) {
                return infoPopup(action.name, `${action.name} only works on Intelligence, Wisdom, or Charisma saving throws.`, auto);
            }

            await setRuntimeValue(playerName, trackingKey, 'rest', campaignName);

            const saveLabel = saveType ? saveType.toUpperCase() : 'Save';
            const description = `<b>${action.name}</b><br/>` +
                `${saveLabel}: d20(${lastAttack.d20}) + ${lastAttack.bonus} = ${lastAttack.d20 + lastAttack.bonus}` +
                ` → <strong>SUCCESS (Guarded Mind)</strong>`;

            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: action.name,
                description: `${playerName} used ${action.name} to override a failed ${saveLabel} save.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[autoReroll] Error:", e); });

            return infoPopup(action.name, description, auto);
        }

        const costError = await consumeResourceCost(auto, playerStats, campaignName);
        if (costError) return costError;

        const isSave = lastAttack?.rollType === 'save';
        const isPlayerSave = lastAttack?.targetName === playerName;

        if (!isSave || !isPlayerSave) {
            return infoPopup(action.name, `No recent saving throw found for ${playerName}. This feature can only be used shortly after a saving throw.`, auto);
        }

        const result = handleSaveRoll(action, 0, lastAttack);

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} used ${action.name} to reroll a saving throw.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[autoReroll] Error:", e); });

        return result;
    }

    const bardicDieSize = getBardicDieSize(playerStats);

    if (bardicDieSize > 0 && auto.bonusExpression === 'bardic_inspiration_die') {
        const usesMax = playerStats?.class?.class_levels?.[(playerStats.level || 1) - 1]?.bardic_inspiration_uses
            ?? (playerStats.proficiency || 0);

        if (usesMax > 0) {
            const currentUses = Number(getRuntimeValue(playerName, 'bardicInspirationUses', campaignName) ?? usesMax);
            if (currentUses <= 0) {
                return infoPopup(action.name, `${action.name} has no uses remaining. Recharges on a Long Rest.`, auto);
            }
        }

        const biDieRoll = Math.floor(Math.random() * bardicDieSize) + 1;

        const isAttackMiss = lastAttack?.rollType === 'attack' && lastAttack.hit === false;
        const isPlayerAttack = lastAttack?.attackerName === playerName;
        const isCheck = (lastAttack?.rollType === 'check' || lastAttack?.rollType === 'skill');
        const isPlayerCheck = lastAttack?.attackerName === playerName;

        const attackFresh = isAttackMiss && isPlayerAttack;
        const abilityFresh = isCheck && isPlayerCheck;

        if (!attackFresh && !abilityFresh) {
            return infoPopup(action.name, `No recent failed ability check or attack roll found. ${action.name} can only be used shortly after a failure.`, auto);
        }

        let result;
        if (attackFresh) {
            result = handleAttackRoll(action, biDieRoll, lastAttack);
        } else {
            result = handleAbilityCheck(action, biDieRoll, lastAttack);
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
        }).catch((e) => { console.error("[autoReroll] Error:", e); });

        return result;
    }

    if (auto.bonusExpression === 'psionic_energy_die') {
        const usesKey = 'psionicEnergy';
        const defaultMax = playerStats._trackedResources?.[usesKey]?.max || 6;
        const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? defaultMax);

        if (currentUses <= 0) {
            return infoPopup(action.name, `${action.name}: No Psionic Energy remaining. Recharges on a Short or Long Rest.`, auto);
        }

        const psionicDieSize = evaluateAutoExpression('psionic_energy_die', playerStats);
        const dieRoll = Math.floor(Math.random() * psionicDieSize) + 1;

        const isAttackMiss = lastAttack?.rollType === 'attack' && lastAttack.hit === false;
        const isPlayerAttack = lastAttack?.attackerName === playerName;
        const isCheck = (lastAttack?.rollType === 'check' || lastAttack?.rollType === 'skill');
        const isPlayerCheck = lastAttack?.attackerName === playerName;

        const attackFresh = isAttackMiss && isPlayerAttack;
        const abilityFresh = isCheck && isPlayerCheck;

        if (!attackFresh && !abilityFresh) {
            return infoPopup(action.name, `No recent failed ability check or attack roll found. ${action.name} can only be used shortly after a failure.`, auto);
        }

        let result;
        if (attackFresh) {
            result = handleAttackRoll(action, dieRoll, lastAttack);
        } else {
            result = handleAbilityCheck(action, dieRoll, lastAttack);
        }

        await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} used ${action.name}: rolled 1d${psionicDieSize} (${dieRoll}) to failed attack roll. Psionic Energy: ${currentUses - 1}/${defaultMax}.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[autoReroll] Error:", e); });

        return result;
    }

    if (auto.effect === 'convert_miss_to_hit') {
        if (auto.oncePerTurn) {
            const currentRound = getCurrentCombatRound();
            const trackingKey = `_fearlessAim_usedRound`;
            const usedRound = getRuntimeValue(playerName, trackingKey, campaignName);
            if (usedRound === currentRound) {
                return infoPopup(action.name, `${action.name} can only be used once per turn.`, auto);
            }
        }

        const isAttack = lastAttack?.rollType === 'attack';
        const isPlayerAttack = lastAttack?.attackerName === playerName;

        if (!isAttack || !isPlayerAttack) {
            return infoPopup(action.name, `No recent attack roll found for ${playerName}. This feature can only be used shortly after an attack roll.`, auto);
        }

        if (lastAttack.hit !== false) {
            return infoPopup(action.name, `The last attack already hit — ${action.name} only works when you miss.`, auto);
        }

        if (auto.oncePerTurn) {
            const currentRound = getCurrentCombatRound();
            const trackingKey = `_fearlessAim_usedRound`;
            await setRuntimeValue(playerName, trackingKey, currentRound, campaignName);
        }

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} used ${action.name} to convert a miss into a hit.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[autoReroll] Error:", e); });

        return infoPopup(action.name, `<b>${action.name}</b><br/>` +
            `d20(${lastAttack.d20}) + ${lastAttack.bonus} = ${lastAttack.d20 + lastAttack.bonus} vs AC ${lastAttack.targetAc || '—'} → <b>MISS</b><br/>` +
            `<br/><i>Miss converted to hit!</i>`, auto);
    }

    if (auto.bonus != null) {
        const bonus = Number(auto.bonus);

        const costError = await consumeResourceCost(auto, playerStats, campaignName);
        if (costError) return costError;

        const isAttackMiss = lastAttack?.rollType === 'attack' && lastAttack.hit === false;
        const isCheck = (lastAttack?.rollType === 'check' || lastAttack?.rollType === 'skill');
        const isPlayerAttack = lastAttack?.attackerName === playerName;
        const isPlayerCheck = lastAttack?.attackerName === playerName;

        const attackFresh = isAttackMiss && isPlayerAttack;
        const abilityFresh = isCheck && isPlayerCheck;

        if (attackFresh) {
            const result = handleAttackRoll(action, bonus, lastAttack);
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: action.name,
                description: `${playerName} used ${action.name}: +${bonus} to own failed attack roll.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[autoReroll] Error:", e); });
            return result;
        }
        if (abilityFresh) {
            const result = handleAbilityCheck(action, bonus, lastAttack);
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: action.name,
                description: `${playerName} used ${action.name}: +${bonus} to own failed ability check.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[autoReroll] Error:", e); });
            return result;
        }

        if (auto.range) {
            const rangeFt = rangeToFeet(auto.range);
            const ally = await findAllyMissedAttack(playerStats, campaignName, mapName, rangeFt);
            if (ally) {
                const result = handleAttackRoll(action, bonus, ally.attackEvent);
                addEntry(campaignName, {
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: action.name,
                    description: `${playerName} used ${action.name}: +${bonus} to ${ally.name}'s failed attack roll.`,
                    targetName: ally.name,
                    timestamp: Date.now(),
                }).catch((e) => { console.error("[autoReroll] Error:", e); });
                return result;
            }
        }

        return infoPopup(action.name, 'No recent failed attack roll or ability check found for you or any ally within range.', auto);
    }

    return automationInfoPopup(action);
}
