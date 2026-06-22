import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { buildSaveDc } from '../../common/savePrompt.js';
import { getCurrentCombatRound } from '../../../../services/encounters/combatData.js';
import { loadManeuvers } from '../../../ui/dataLoader.js';

const SELECTION_KEY = 'BattleMasterManeuvers_selection';

function getKnownManeuvers(playerStats, campaignName) {
    const stored = getRuntimeValue(playerStats.name, SELECTION_KEY, campaignName);
    return Array.isArray(stored) ? stored : [];
}

function hasRelentless(playerStats) {
    return (playerStats.automation?.passives || []).some(p => p.type === 'passive_rule' && p.effect === 'relentless');
}

function getRelentlessUsedRound(playerStats, campaignName) {
    return getRuntimeValue(playerStats.name, 'relentlessUsedRound', campaignName);
}

function setRelentlessUsed(playerStats, campaignName) {
    const currentRound = getCurrentCombatRound();
    setRuntimeValue(playerStats.name, 'relentlessUsedRound', currentRound, campaignName);
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const knownManeuvers = getKnownManeuvers(playerStats, campaignName);
    const allManeuvers = await loadManeuvers(playerStats.rules || '2024');

    if (!allManeuvers.length) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No maneuver data available.',
                automation: auto,
            },
        };
    }

    const maxOptions = auto.maxOptions || 3;

    const unknownManeuvers = allManeuvers.filter(m => !knownManeuvers.includes(m.name));
    const known = allManeuvers.filter(m => knownManeuvers.includes(m.name));

    const needsSelection = known.length < maxOptions && unknownManeuvers.length > 0;

    const modalPayload = {
        action,
        playerStats,
        campaignName,
        allManeuvers,
        knownManeuvers: known.map(m => m.name),
        maxOptions,
        selectionMode: needsSelection,
        saveDc: auto.saveDc,
        saveType: auto.saveType || 'WIS',
        dieExpression: auto.dieExpression || 'superiority_die',
    };

    return {
        type: 'modal',
        modalName: 'combatSuperiority',
        payload: modalPayload,
    };
}

export async function onCombatSuperioritySelected(action, playerStats, campaignName, selectedManeuverNames, singleUseManeuverName) {
    const auto = action.automation;

    if (Array.isArray(selectedManeuverNames)) {
        const allManeuvers = await loadManeuvers(playerStats.rules || '2024');

        if (selectedManeuverNames.length === 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: 'Combat Superiority selection cleared.',
                    automation: auto,
                },
            };
        }

        const validNames = selectedManeuverNames.filter(n =>
            allManeuvers.some(m => m.name === n)
        );

        await setRuntimeValue(playerStats.name, SELECTION_KEY, validNames, campaignName, true);

        const namesHtml = validNames.map(n => `<b>${n}</b>`).join(', ');
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Maneuvers selected: ${namesHtml}. You can now use these by using Combat Superiority during combat.`,
                automation: auto,
            },
        };
    }

    if (singleUseManeuverName) {
        return executeManeuver(action, playerStats, campaignName, singleUseManeuverName);
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: 'No maneuver selected.',
            automation: auto,
        },
    };
}

async function executeManeuver(action, playerStats, campaignName, maneuverName) {
    const auto = action.automation;
    const allManeuvers = await loadManeuvers(playerStats.rules || '2024');
    const maneuver = allManeuvers.find(m => m.name === maneuverName);

    if (!maneuver) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Maneuver "${maneuverName}" not found.`,
                automation: auto,
            },
        };
    }

    const usesKey = 'superiorityDice';
    const defaultMax = auto.uses_max || 4;
    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? defaultMax);

    const relentless = hasRelentless(playerStats);
    const storedRound = getRelentlessUsedRound(playerStats, campaignName);
    const currentRound = getCurrentCombatRound();
    const relentlessUsed = relentless && storedRound === currentRound;

    if (currentUses <= 0 && !relentless) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: maneuver.name,
                description: `${maneuver.name}: No Superiority Dice remaining. Recharges on a Short or Long Rest.`,
                automation: auto,
            },
        };
    }

    const superiorityDieSize = evaluateAutoExpression(maneuver.dieExpression || 'superiority_die', playerStats);

    const targetInfo = await resolveTarget(campaignName, playerStats.name);
    const targetName = targetInfo?.target?.name || null;

    let dieValue;
    let dieDescription;
    let expendedDie = true;

    if (relentless && !relentlessUsed) {
        const relentlessRoll = rollExpression('1d8');
        dieValue = relentlessRoll?.total || 8;
        dieDescription = `Rolled 1d8 for ${dieValue} (Relentless).`;
        setRelentlessUsed(playerStats, campaignName);
        expendedDie = false;
    } else {
        const dieRoll = rollExpression(`1d${superiorityDieSize}`);
        dieValue = dieRoll?.total || superiorityDieSize;
        dieDescription = `Rolled ${superiorityDieSize} for ${dieValue}.`;
    }

    if (expendedDie) {
        await setRuntimeValue(playerStats.name, 'superiorityDice', currentUses - 1, campaignName);
    }

    let description = `${maneuver.name}: ${dieDescription}`;

    if (targetName) {
        description += ` Target: ${targetName}.`;
    }

    if (maneuver.damageBonus) {
        description += ` Added ${dieValue} to the damage roll.`;
    }

    if (maneuver.saveType) {
        const saveDc = buildSaveDc(auto, playerStats);
        description += ` Target must make a ${maneuver.saveType} save DC ${saveDc}`;
        if (maneuver.conditionInflicted) {
            description += ` or gain ${maneuver.conditionInflicted} condition`;
        } else if (maneuver.effect === 'disarm') {
            description += ` or drop one object it's holding`;
        } else if (maneuver.effect === 'push') {
            description += ` or be pushed ${maneuver.value || 15} feet away`;
        } else if (maneuver.effect === 'goad') {
            description += ` or have Disadvantage on attacks against targets other than you`;
        } else {
            description += ` or suffer the effect`;
        }
        description += '.';
    }

    if (maneuver.effect === 'next_attack_advantage') {
        description += ` The next attack against ${targetName || 'the target'} by an ally has Advantage.`;
    }

    if (maneuver.effect === 'ally_movement') {
        description += ` An ally can use its Reaction to move up to half its Speed without provoking Opportunity Attacks.`;
    }

    if (maneuver.actionType === 'grant_attack') {
        description += ` An ally can use its Reaction to make an attack, adding ${dieValue} to the damage roll.`;
    }

    if (maneuver.effect === 'ac_bonus_and_swap') {
        description += ` You or the ally gains +${dieValue} AC until the start of your next turn.`;
    }

    if (maneuver.effect === 'ac_bonus_disengage') {
        description += ` You take the Disengage action and gain +${dieValue} AC until the start of your next turn.`;
    }

    if (maneuver.effect === 'advantage_and_damage') {
        description += ` You have Advantage on your next attack roll against the target. If it hits, add ${dieValue} to the damage roll.`;
    }

    if (maneuver.effect === 'dash_and_damage') {
        description += ` You take the Dash action. If you move 5+ feet in a straight line before a melee hit this turn, add ${dieValue} to the damage roll.`;
    }

    if (maneuver.effect === 'temp_hp') {
        const fighterLevel = playerStats.level || 1;
        const extraHp = Math.floor(fighterLevel / 2);
        const totalHp = dieValue + extraHp;
        description += ` An ally gains ${totalHp} Temporary Hit Points (${dieValue} from die + ${extraHp} from half Fighter level).`;
    }

    if (maneuver.effect === 'damage_reduction') {
        const strMod = (playerStats.abilities || []).find(a => a.name === 'Strength')?.bonus || 0;
        const dexMod = (playerStats.abilities || []).find(a => a.name === 'Dexterity')?.bonus || 0;
        const mod = Math.max(strMod, dexMod);
        const reduction = dieValue + mod;
        description += ` Damage reduced by ${reduction} (${dieValue} + ${mod} from STR/DEX modifier).`;
    }

    if (maneuver.effect === 'melee_attack_reaction') {
        description += ` Make a melee attack against the target. On a hit, add ${dieValue} to the damage roll.`;
    }

    if (maneuver.effect === 'secondary_damage') {
        description += ` A second creature within 5 feet of the target takes ${dieValue} damage (same type as the original attack).`;
    }

    if (maneuver.effect === 'attack_roll_bonus') {
        description += ` Add ${dieValue} to the attack roll.`;
    }

    if (maneuver.actionType === 'skill_check') {
        description += ` Add ${dieValue} to the ability check.`;
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: maneuver.name,
            description,
            automation: auto,
        },
    };
}
