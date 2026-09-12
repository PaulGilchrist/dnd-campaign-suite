import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { loadCombatSummary, getCurrentCombatRound } from '../../../encounters/combatData.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import storage from '../../../../services/ui/storage.js';
import { addCondition } from '../../../../services/combat/conditions/conditionSaveService.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';

const STRIKE_RANGE_FT = 30;

function infoPopup(name, description, auto) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name,
            description,
            automation: auto,
        },
    };
}

// CLA-273 trigger gate: Psionic Strike may only fire immediately after the
// attacker themselves hit a target with a weapon attack and dealt damage
// (mirrors the verified lastAttack latch in reactionDebuffHandler).
async function checkTriggerGate(action, playerName, campaignName, targetName) {
    const attackResult = await findLastAttack(campaignName);
    const attackEvent = attackResult.attackEvent;
    if (!attackEvent) {
        return infoPopup(action.name, `${action.name} requires a weapon hit. No recent attack found — no Psionic Energy spent.`, action.automation);
    }
    if (attackEvent.attackerName !== playerName) {
        return infoPopup(action.name, `${action.name} requires a weapon hit made by you. Last attack was made by ${attackEvent.attackerName || 'another creature'} — no Psionic Energy spent.`, action.automation);
    }
    if (attackEvent.rollType !== 'attack' || attackEvent.isCantrip || attackEvent.isUnarmedStrike) {
        return infoPopup(action.name, `${action.name} requires a weapon attack — no Psionic Energy spent.`, action.automation);
    }
    if (attackEvent.hit !== true) {
        return infoPopup(action.name, `${action.name} requires a weapon hit. Your last attack missed — no Psionic Energy spent.`, action.automation);
    }
    if (attackResult.totalDamage <= 0) {
        return infoPopup(action.name, `${action.name} requires your attack to deal damage — no Psionic Energy spent.`, action.automation);
    }
    if (attackEvent.targetName !== targetName) {
        return infoPopup(action.name, `${action.name} must target the creature you just hit (${attackEvent.targetName}) — no Psionic Energy spent.`, action.automation);
    }
    const inRange = await isWithinRange(playerName, targetName, STRIKE_RANGE_FT);
    if (!inRange) {
        return infoPopup(action.name, `${targetName} is out of ${STRIKE_RANGE_FT} feet — no Psionic Energy spent.`, action.automation);
    }
    return null;
}

async function resolveThrustChain(action, playerStats, campaignName, targetName) {
    const thrustAutomation = (playerStats.automation?.reactions || []).find(r => r.type === 'telekinetic_thrust');
    if (!thrustAutomation) return null;

    // CLA-273: lv7 Telekinetic Adept's Thrust only chains after a Psionic
    // Strike that actually dealt damage, and respects its own oncePerTurn latch.
    const currentRound = getCurrentCombatRound(campaignName);
    const thrustUsedRound = getRuntimeValue(playerStats.name, 'telekineticThrustUsedRound', campaignName);
    if (thrustAutomation.oncePerTurn && thrustUsedRound != null && Number(thrustUsedRound) === currentRound) {
        return null;
    }
    if (thrustAutomation.oncePerTurn) {
        setRuntimeValue(playerStats.name, 'telekineticThrustUsedRound', currentRound, campaignName);
    }

    // CLA-355: once per Short or Long Rest uses gate (null = re-armed by rest).
    const thrustMax = playerStats._trackedResources?.telekineticThrustUses?.max ?? 1;
    const thrustUses = Number(getRuntimeValue(playerStats.name, 'telekineticThrustUses', campaignName) ?? thrustMax);
    if (thrustUses <= 0) {
        await addEntry(campaignName, {
            type: 'automation',
            characterName: playerStats.name,
            automationType: 'telekinetic_thrust_refused',
            name: 'Telekinetic Thrust',
            description: 'Telekinetic Thrust has no uses remaining. Recharges when you finish a Short or Long Rest.',
            timestamp: Date.now(),
        }).catch((e) => { console.error("[psionicStrikeHandler:log-error]", e); });
        return null;
    }
    await setRuntimeValue(playerStats.name, 'telekineticThrustUses', thrustUses - 1, campaignName);

    const saveType = thrustAutomation.saveType || 'STR';
    const saveDc = buildSaveDc(thrustAutomation, playerStats);
    const { promise } = createSaveListener(campaignName, {
        targetName,
        saveType,
        saveDc,
    });

    await addEntry(campaignName, {
        type: 'roll',
        name: 'Telekinetic Adept',
        characterName: playerStats.name,
        rollType: 'save-damage',
        targetName,
        saveDc,
        saveType,
        description: `Telekinetic Adept — ${targetName} must make a ${saveType} saving throw (DC ${saveDc}).`,
    }).catch((e) => { console.error("[psionicStrikeHandler:log-error]", e); });

    const saveResult = await promise;
    const success = saveResult.success;

    if (success) {
        return `${targetName} saved vs Telekinetic Adept (DC ${saveDc}).`;
    }

    const cs = await getCombatContext(campaignName);
    await knockThrustTargetProne(cs, campaignName, targetName, saveDc, saveType, playerStats);
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Telekinetic Thrust',
        description: `${playerStats.name} pushed ${targetName} 10 feet away.`,
        targetName: targetName,
    }).catch((e) => { console.error("[psionicStrikeHandler:log-error]", e); });

    return `${targetName} failed the ${saveType} save (DC ${saveDc}) — Prone + pushed 10ft.`;
}

async function knockThrustTargetProne(cs, campaignName, targetName, saveDc, saveType, playerStats) {
    if (!cs?.creatures) return;
    const targetCreature = cs.creatures.find(c => c.name === targetName);
    if (!targetCreature) return;
    const proneAlready = targetCreature.conditions?.some(c => c.key === 'prone');
    if (proneAlready) return;
    const conditionDef = { key: 'prone', label: 'Prone' };
    addCondition(cs, targetName, conditionDef, saveDc, saveType, getRuntimeValue, setRuntimeValue, campaignName, playerStats);
    storage.set('combatSummary', cs, campaignName);
}

// Resource + once-per-turn gates. Returns a refusal popup, or null when clear.
function gatePsionicStrikeUse({ auto, action, playerName, campaignName, currentRound, currentUses }) {
    if (currentUses <= 0) {
        return infoPopup(action.name, `${action.name}: No Psionic Energy remaining. Recharges on a Short or Long Rest.`, auto);
    }

    // CLA-273: round-keyed once-per-turn latch (CLA-109 pattern) — replaces the
    // never-written 'currentTurn'/'unknown' sentinel so later turns re-arm properly.
    if (auto.oncePerTurn) {
        const usedRound = getRuntimeValue(playerName, 'psionicStrikeUsedThisTurn', campaignName);
        if (usedRound != null && Number(usedRound) === currentRound) {
            return infoPopup(action.name, `${action.name}: Already used this turn. Once per turn.`, auto);
        }
    }

    return null;
}

function rollPsionicDamage(playerStats) {
    const psionicDieSize = evaluateAutoExpression('psionic_energy_die', playerStats);
    const dieRoll = rollExpression(`1d${psionicDieSize}`);
    const dieValue = dieRoll?.total || psionicDieSize;
    const abilities = playerStats.abilities || [];
    const intAbility = abilities.find(a => a.name === 'Intelligence');
    const intMod = (intAbility && intAbility.bonus) || 0;
    return { psionicDieSize, dieValue, intMod };
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const usesKey = auto.resource || 'psionicEnergy';
    const defaultMax = playerStats._trackedResources?.[usesKey]?.max || 6;
    const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? defaultMax);

    const currentRound = getCurrentCombatRound(campaignName);
    const useRefusal = gatePsionicStrikeUse({ auto, action, playerName, campaignName, currentRound, currentUses });
    if (useRefusal) return useRefusal;

    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerName) : null;
    const targetName = target?.name || null;

    if (!targetName) {
        return infoPopup(action.name, `${action.name}: No target available. Select a creature in combat and try again.`, auto);
    }

    const gateRefusal = await checkTriggerGate(action, playerName, campaignName, targetName);
    if (gateRefusal) return gateRefusal;

    const { psionicDieSize, dieValue, intMod } = rollPsionicDamage(playerStats);
    const totalDamage = dieValue + intMod;

    const combatSummary = await loadCombatSummary(campaignName);
    const characters = getRuntimeValue('characters', 'characters', campaignName) || [];
    await applyDamageToTarget(combatSummary, targetName, totalDamage, ['Force'], campaignName, characters, { ignoreResistance: false, attackerName: playerName });

    await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);

    if (auto.oncePerTurn) {
        await setRuntimeValue(playerName, 'psionicStrikeUsedThisTurn', currentRound, campaignName);
    }

    const thrustResult = await resolveThrustChain(action, playerStats, campaignName, targetName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} to deal ${totalDamage} Force damage to ${targetName} (Rolled d${psionicDieSize}: ${dieValue} + INT ${intMod}).`,
    }).catch((e) => { console.error("[psionicStrikeHandler:log-error]", e); });

    await addEntry(campaignName, {
        type: 'roll',
        characterName: playerName,
        rollType: 'damage',
        name: 'Psionic Strike Damage',
        targetName,
        damageType: 'Force',
        total: totalDamage,
        formula: `1d${psionicDieSize} + ${intMod}`,
        rolls: [dieValue, intMod],
    }).catch((e) => { console.error("[psionicStrikeHandler:log-error]", e); });

    let description = `${action.name}: Dealt <strong>${totalDamage}</strong> Force damage to ${targetName}. (Rolled d${psionicDieSize}: ${dieValue} + INT ${intMod}). Psionic Energy: ${currentUses - 1}/${defaultMax}.`;
    if (thrustResult) {
        description += `<br/><br/>${thrustResult}`;
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            targetName,
            description,
            automation: auto,
        },
    };
}
