import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { getCurrentCombatRound } from '../../../../services/encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import {
    findManeuver,
    checkSuperiorityDice,
    expendSuperiorityDie,
    rollManeuverDie,
    buildManeuverNotFoundPopup,
    buildNoDiceRemainingPopup,
    filterMeleeAttacks,
} from './combatSuperiorityUtils.js';

// ── Bonus Action Maneuvers ──────────────────────────────────────────────

// Effects whose popup description omits the resolved target name.
const BONUS_TARGETLESS_EFFECTS = new Set(['ac_bonus_disengage', 'dash_and_damage']);

// MN-016: Rally resolves its ally picker in a modal — gate on ally availability
// BEFORE roll/expend so a no-allies click neither rolls nor spends a die.
async function gateRallyAllies(maneuver, playerStats, campaignName) {
    if (maneuver.effect !== 'temp_hp') return { rallyAllies: [] };
    const cs = await getCombatContext(campaignName);
    const creatures = cs && cs.creatures ? cs.creatures : [];
    const rallyAllies = creatures.filter(c => c.name !== playerStats.name);
    if (rallyAllies.length === 0) {
        return {
            popup: {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: maneuver.name,
                    description: `${maneuver.name}: No allies available to receive Rally.`,
                },
                logEntries: [{
                    type: 'ability_use',
                    characterName: playerStats.name,
                    abilityName: maneuver.name,
                    description: `${maneuver.name}: No allies available to receive Rally.`,
                }],
            },
        };
    }
    return { rallyAllies };
}

function computeRallyExtraHp(maneuver, playerStats) {
    const fighterLevel = playerStats.level || 1;
    const fallback = Math.floor(fighterLevel / 2);
    const extraHpRaw = maneuver.extraHpExpression
        ? evaluateAutoExpression(maneuver.extraHpExpression, playerStats)
        : fallback;
    return typeof extraHpRaw === 'number' ? Math.floor(extraHpRaw) : fallback;
}

function buildRallyModal({ maneuver, playerStats, campaignName, dieValue, rallyAllies, description }) {
    const extraHp = computeRallyExtraHp(maneuver, playerStats);
    const totalHp = dieValue + extraHp;
    const allyOptions = rallyAllies.map(a => ({ label: a.name, value: a.name }));
    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description: `${maneuver.name}: Choose an ally to gain temporary hit points.`,
    };
    return {
        type: 'modal',
        modalName: 'rallyChoice',
        payload: {
            playerStats,
            campaignName,
            dieValue,
            maneuverName: maneuver.name,
            allyOptions,
            totalHp,
            extraHp,
            description,
        },
        logEntries: [logEntry],
    };
}

// Bonus-action maneuver effect side effects → appended description text.
const BONUS_EFFECT_APPLIERS = {
    ac_bonus_disengage: async ({ maneuver, playerStats, campaignName, dieValue }) => {
        await setRuntimeValue(playerStats.name, 'baitAndSwitchActive', true, campaignName);
        await setRuntimeValue(playerStats.name, 'baitAndSwitchBonus', dieValue, campaignName);
        await setRuntimeValue(playerStats.name, 'baitAndSwitchSource', maneuver.name, campaignName);
        await addExpiration({ attackerName: playerStats.name, targetName: playerStats.name, effects: [
            { type: 'bait_and_switch_clear' }
        ], campaignName, rounds: undefined, expireOnCreatureName: playerStats.name });
        return ` You take the Disengage action and gain +${dieValue} AC until the start of your next turn.`;
    },
    advantage_and_damage: async ({ maneuver, playerStats, campaignName, dieValue, targetName }) => {
        await setRuntimeValue(playerStats.name, 'feintingAttackDieValue', dieValue, campaignName);
        const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
        const currentRound = getCurrentCombatRound();
        const newEffect = {
            target: playerStats.name,
            source: maneuver.name,
            effect: 'next_attack_advantage',
            vexTarget: targetName || null,
            value: null,
            duration: 'until_end_of_turn',
            appliedRound: currentRound,
        };
        await setRuntimeValue('campaign', 'targetEffects', [...storedEffects, newEffect], campaignName);
        addExpiration({ attackerName: playerStats.name, targetName: playerStats.name, effects: [
            { type: 'remove_target_effect', effectKey: 'next_attack_advantage', source: maneuver.name, target: playerStats.name }
        ], campaignName, rounds: 2 });
        return ` You have Advantage on your next attack roll against the target. If it hits, add ${dieValue} to the damage roll.`;
    },
    dash_and_damage: async ({ playerStats, campaignName, dieValue }) => {
        await setRuntimeValue(playerStats.name, 'lungingAttackDieValue', dieValue, campaignName);
        return ` You take the Dash action. Add ${dieValue} to the damage roll of your next melee hit this turn.`;
    },
};

export async function executeBonusActionManeuver(action, playerStats, campaignName, maneuverName) {
    const maneuver = await findManeuver(maneuverName, playerStats.rules);

    if (!maneuver) {
        return buildManeuverNotFoundPopup(maneuverName, maneuverName);
    }

    const { superiorityDice, hasDiceRemaining } = checkSuperiorityDice(playerStats, campaignName);

    if (!hasDiceRemaining) {
        return buildNoDiceRemainingPopup(maneuver.name);
    }

    const targetInfo = await resolveTarget(campaignName, playerStats.name);
    const target = targetInfo && targetInfo.target;
    const targetName = target ? target.name : null;

    const rallyGate = await gateRallyAllies(maneuver, playerStats, campaignName);
    if (rallyGate.popup) return rallyGate.popup;

    const { dieValue, dieDescription, expendedDie } = rollManeuverDie(maneuver, playerStats, campaignName);
    await expendSuperiorityDie(playerStats, campaignName, expendedDie, superiorityDice);

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description: `Used ${maneuver.name} as a bonus action. ${dieDescription} ${maneuver.description}`,
    };

    let description = `<b>${maneuver.name}</b> (Bonus Action)<br/>${dieDescription}`;

    if (targetName && !BONUS_TARGETLESS_EFFECTS.has(maneuver.effect)) {
        description += ` Target: ${targetName}.`;
    }

    if (maneuver.saveType) {
        description += ` Target must make a ${maneuver.saveType} save or suffer the effect.`;
    }

    if (maneuver.effect === 'temp_hp') {
        return buildRallyModal({
    maneuver,
    playerStats,
    campaignName,
    dieValue,
    rallyAllies: rallyGate.rallyAllies,
    description,
});
    }

    const applyEffect = BONUS_EFFECT_APPLIERS[maneuver.effect];
    if (applyEffect) {
        description += await applyEffect({ maneuver, playerStats, campaignName, dieValue, targetName });
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: maneuver.name,
            description,
        },
        logEntries: [logEntry],
    };
}

// ── Grant Attack Maneuvers ──────────────────────────────────────────────

// MN-003: once-per-Attack-action round latch on the grantor (CLA-071/MN-017
// latch shape) — re-armed at round wrap via PLAYER_ROUND_LATCH_KEYS
// (navigationHandlers.js) and Initiative.jsx clearPlayerRoundFlags. Refusals
// roll nothing, spend nothing, stamp nothing (zero-spend reason tokens).
const COMMANDERS_STRIKE_USED_ROUND_KEY = '_Commanders_Strike_usedRound';

function commanderStrikeRefusal(maneuver, playerName, description, reason) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: maneuver.name,
            description,
        },
        logEntries: [{
            type: 'automation',
            automationType: 'commanders_strike_refused',
            name: maneuver.name,
            characterName: playerName,
            reason,
            description,
            timestamp: Date.now(),
        }],
    };
}

export async function executeGrantAttackManeuver(action, playerStats, campaignName, maneuverName) {
    const maneuver = await findManeuver(maneuverName, playerStats.rules);

    if (!maneuver) {
        return buildManeuverNotFoundPopup(maneuverName, maneuverName);
    }

    const currentRound = getCurrentCombatRound(campaignName);
    const usedRound = Number(getRuntimeValue(playerStats.name, COMMANDERS_STRIKE_USED_ROUND_KEY, campaignName) ?? 0);
    if (usedRound === Number(currentRound)) {
        return commanderStrikeRefusal(
            maneuver,
            playerStats.name,
            `${maneuver.name}: already directed a companion this turn — it can replace only one attack of the Attack action per turn. Nothing spent.`,
            'already_used_this_turn'
        );
    }

    const { superiorityDice, hasDiceRemaining } = checkSuperiorityDice(playerStats, campaignName);

    if (!hasDiceRemaining) {
        return buildNoDiceRemainingPopup(maneuver.name);
    }

    // 30_ft range gate BEFORE roll/expend so a refusal never spends a die
    // (gridless positions resolve LENIENT — consulted-and-passes is enough).
    const rangeFt = rangeToFeet(maneuver.range || '30_ft');
    const cs = await getCombatContext(campaignName);
    const allies = (cs?.creatures || []).filter(c => c.name !== playerStats.name);
    const inRangeAllies = [];
    for (const ally of allies) {
        if (await isWithinRange(playerStats.name, ally.name, rangeFt)) {
            inRangeAllies.push(ally);
        }
    }
    const options = inRangeAllies.map(a => ({ label: a.name, value: a.name }));

    if (options.length === 0) {
        return commanderStrikeRefusal(
            maneuver,
            playerStats.name,
            `${maneuver.name}: No willing companion within ${rangeFt} feet to direct. Nothing spent.`,
            'no_ally_in_range'
        );
    }

    const { dieValue, dieDescription, expendedDie } = rollManeuverDie(maneuver, playerStats, campaignName);
    await expendSuperiorityDie(playerStats, campaignName, expendedDie, superiorityDice);
    // Latch stamp awaited BEFORE consumers read (§5: races lose writes).
    await setRuntimeValue(playerStats.name, COMMANDERS_STRIKE_USED_ROUND_KEY, currentRound, campaignName);

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description: `Used ${maneuver.name}. ${dieDescription} Expend 1 Superiority Die. Choose a willing companion within ${rangeFt} feet to add ${dieValue} to their next attack's damage roll on a hit.`,
    };

    const description = `<b>${maneuver.name}</b><br/>${dieDescription} Choose a willing ally within ${rangeFt} feet to add ${dieValue} to their next attack's damage roll on a hit.`;

    return {
        type: 'modal',
        modalName: 'commanderStrikeChoice',
        payload: {
            playerStats,
            campaignName,
            dieValue,
            maneuverName: maneuver.name,
            options,
            description,
        },
        logEntries: [logEntry],
    };
}

// ── Movement Maneuvers ──────────────────────────────────────────────────

export async function executeMovementManeuver(action, playerStats, campaignName, maneuverName) {
    const maneuver = await findManeuver(maneuverName, playerStats.rules);

    if (!maneuver) {
        return buildManeuverNotFoundPopup(maneuverName, maneuverName);
    }

    const { superiorityDice, hasDiceRemaining } = checkSuperiorityDice(playerStats, campaignName);

    if (!hasDiceRemaining) {
        return buildNoDiceRemainingPopup(maneuver.name);
    }

    const { dieValue, dieDescription, expendedDie } = rollManeuverDie(maneuver, playerStats, campaignName);
    await expendSuperiorityDie(playerStats, campaignName, expendedDie, superiorityDice);

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description: `Used ${maneuver.name}. ${dieDescription} You or the ally gains +${dieValue} AC until the start of your next turn.`,
    };

    let description = `<b>${maneuver.name}</b><br/>${dieDescription}`;

    if (maneuver.effect === 'ac_bonus_and_swap') {
        description += ` You or an ally gains +${dieValue} AC until the start of your next turn.`;
        const cs = await getCombatContext(campaignName);
        const allies = cs?.creatures?.filter(c => c.name !== playerStats.name) || [];
        const options = [
            { label: `Myself (${playerStats.name})`, value: playerStats.name },
            ...allies.map(a => ({ label: a.name, value: a.name })),
        ];
        return {
            type: 'modal',
            modalName: 'baitAndSwitchChoice',
            payload: {
                playerStats,
                campaignName,
                dieValue,
                maneuverName: maneuver.name,
                options,
                description,
            },
            logEntries: [logEntry],
        };
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: maneuver.name,
            description: `${description} You or the ally gains +${dieValue} AC until the start of your next turn.`,
        },
        logEntries: [logEntry],
    };
}

// ── Skill Check Maneuvers ───────────────────────────────────────────────

export async function executeSkillCheckManeuver(action, playerStats, campaignName, maneuverName) {
    const maneuver = await findManeuver(maneuverName, playerStats.rules);

    if (!maneuver) {
        return buildManeuverNotFoundPopup(maneuverName, maneuverName);
    }

    const { superiorityDice, hasDiceRemaining } = checkSuperiorityDice(playerStats, campaignName);

    if (!hasDiceRemaining) {
        return buildNoDiceRemainingPopup(maneuver.name);
    }

    const { dieValue, dieDescription, expendedDie } = rollManeuverDie(maneuver, playerStats, campaignName);
    await expendSuperiorityDie(playerStats, campaignName, expendedDie, superiorityDice);

    await setRuntimeValue(playerStats.name, 'pendingSkillCheckBonus', dieValue, campaignName);

    const skills = maneuver.skills || [];
    let skillList = '';
    if (maneuver.initiativeBonus) {
        skillList = 'Initiative or Stealth';
    } else if (skills.length > 0) {
        skillList = skills.join(' / ');
    }

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description: `Used ${maneuver.name}. ${dieDescription} Added ${dieValue} to the next ${skillList || 'skill'} check.`,
    };

    let description = `<b>${maneuver.name}</b><br/>${dieDescription}`;

    if (maneuver.initiativeBonus) {
        description += ` Add ${dieValue} to your next Initiative roll or Dexterity (Stealth) check.`;
    } else {
        const ability = maneuver.ability || 'the ability';
        description += ` Add ${dieValue} to your next ${ability} (${skillList || 'skill check'}).`;
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: maneuver.name,
            description,
        },
        logEntries: [logEntry],
    };
}

// ── Reaction Maneuvers ──────────────────────────────────────────────────

// MN-017: Riposte ("when a creature misses you with a melee attack roll") —
// gated arm-then-row per the CLA-297 Retaliation / CLA-310 Shadowy Dodge house
// standard. Attack-instance latch (_Riposte_appliedAttack) closes "same lastAttack
// reusable forever"; round latch (_Riposte_usedRound) is the Reaction economy
// (cleared at round wrap in initiative.jsx / navigationHandlers.js). Refusals are
// automation_info popups: no roll, no spend, no stamp, no log.
const RIPOSTE_APPLIED_ATTACK_KEY = '_Riposte_appliedAttack';
const RIPOSTE_USED_ROUND_KEY = '_Riposte_usedRound';

function buildRiposteRefusalPopup(maneuverName, description) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: maneuverName,
            description,
        },
    };
}

// Identity of the triggering attack instance: campaign lastAttack is the single
// source of truth; misses may lack a timestamp, so fall back to roll signature +
// attacker (CLA-310 attackIdentity shape).
function riposteAttackIdentity(attackEvent, attackerName) {
    if (attackEvent?.timestamp != null) return String(attackEvent.timestamp);
    return `d20:${attackEvent?.d20 ?? '?'}+${attackEvent?.bonus ?? 0}:${attackerName ?? ''}`;
}

async function gateRiposteReaction(maneuver, playerStats, campaignName) {
    const playerName = playerStats.name;
    const name = maneuver.name;
    const lastAttackResult = await findLastAttack(campaignName);
    const attackEvent = lastAttackResult.attackEvent;
    const attackerName = lastAttackResult.attackerName;

    if (!attackEvent || !attackerName) {
        return { refusal: buildRiposteRefusalPopup(name, `${name}: No recent attack found. ${name} triggers when a creature misses you with a melee attack roll.`) };
    }
    if (attackerName === playerName) {
        return { refusal: buildRiposteRefusalPopup(name, `${name}: you cannot attack yourself — the triggering attack must come from another creature.`) };
    }
    if (lastAttackResult.targetName !== playerName) {
        return { refusal: buildRiposteRefusalPopup(name, `You were not the target of the last attack (${lastAttackResult.targetName} was). ${name} only triggers when a creature misses you.`) };
    }
    if (attackEvent.hit !== false) {
        return { refusal: buildRiposteRefusalPopup(name, `The last attack against you was not a miss. ${name} triggers only when a creature misses you with a melee attack roll.`) };
    }
    if (attackEvent.weaponType === 'ranged') {
        return { refusal: buildRiposteRefusalPopup(name, `The last attack was a Ranged attack. ${name} triggers only when a creature misses you with a melee attack roll.`) };
    }
    const within5ft = await isWithinRange(playerName, attackerName, 5);
    if (!within5ft) {
        return { refusal: buildRiposteRefusalPopup(name, `${attackerName} is not within 5 feet of you. ${name} requires the attacker to be adjacent.`) };
    }
    const combatContext = await getCombatContext(campaignName);
    if (combatContext?.activeCreatureName === playerName) {
        return { refusal: buildRiposteRefusalPopup(name, `${name} is a Reaction — you cannot use it on your own turn.`) };
    }
    const identity = riposteAttackIdentity(attackEvent, attackerName);
    if (getRuntimeValue(playerName, RIPOSTE_APPLIED_ATTACK_KEY, campaignName) === identity) {
        return { refusal: buildRiposteRefusalPopup(name, `Reaction already used — you have already riposted this attack roll. Your Reaction is spent until your next turn.`) };
    }
    const currentRound = combatContext?.round || 1;
    const usedRound = Number(getRuntimeValue(playerName, RIPOSTE_USED_ROUND_KEY, campaignName) ?? 0);
    if (usedRound === currentRound) {
        return { refusal: buildRiposteRefusalPopup(name, `You have already used ${name} this round — your Reaction is spent until your next turn.`) };
    }
    return { attackerName, identity, currentRound };
}

// MN-017: Riposte — trigger-gated reaction. Attack the creature that just
// missed the holder with a melee attack, never resolveTarget.
async function executeRiposteReaction(maneuver, playerStats, campaignName, superiorityDice) {
    const gate = await gateRiposteReaction(maneuver, playerStats, campaignName);
    if (gate.refusal) return gate.refusal;

    const meleeAttacks = filterMeleeAttacks(playerStats.attacks);
    const attack = meleeAttacks.length > 0 ? meleeAttacks[0] : (playerStats.attacks || [])[0];

    if (!attack) {
        return buildRiposteRefusalPopup(maneuver.name, `${maneuver.name}: No melee attack available.`);
    }

    const { dieValue, dieDescription, expendedDie } = rollManeuverDie(maneuver, playerStats, campaignName);
    await expendSuperiorityDie(playerStats, campaignName, expendedDie, superiorityDice);

    // Reaction consumed: arm the die and stamp both latches — sequential
    // awaits (pitfall 21: concurrent full-store POSTs race).
    await setRuntimeValue(playerStats.name, 'pendingRiposteDieValue', dieValue, campaignName);
    await setRuntimeValue(playerStats.name, RIPOSTE_APPLIED_ATTACK_KEY, gate.identity, campaignName);
    await setRuntimeValue(playerStats.name, RIPOSTE_USED_ROUND_KEY, gate.currentRound, campaignName);

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description: `${playerStats.name} used ${maneuver.name} (Reaction) — melee attack against ${gate.attackerName} after their melee attack missed. ${dieDescription} Superiority Die expended.`,
        targetName: gate.attackerName,
        timestamp: Date.now(),
    };

    return {
        type: 'attack_roll',
        payload: {
            attack,
            targetName: gate.attackerName,
        },
        logEntries: [logEntry],
    };
}

// Parry ("damage_reduction"): reduce damage by die + best STR/DEX modifier,
// heal the difference back up, and return the appended description text.
async function applyManeuverDamageReduction(playerStats, campaignName, dieValue) {
    const abilities = playerStats.abilities || [];
    const strMod = (abilities.find(a => a.name === 'Strength') || {}).bonus || 0;
    const dexMod = (abilities.find(a => a.name === 'Dexterity') || {}).bonus || 0;
    const mod = Math.max(strMod, dexMod);
    const reduction = dieValue + mod;
    let description = ` Damage reduced by ${reduction} (${dieValue} + ${mod} from STR/DEX modifier).`;
    const storedMaxHp = getRuntimeValue(playerStats.name, 'hitPoints', campaignName);
    const storedCurrentHp = getRuntimeValue(playerStats.name, 'currentHitPoints', campaignName);
    const maxHp = storedMaxHp != null ? Number(storedMaxHp) : (storedCurrentHp || 10);
    const currentHp = storedCurrentHp != null ? Number(storedCurrentHp) : 10;
    const newHp = Math.min(maxHp, currentHp + reduction);
    if (newHp !== currentHp) {
        await setRuntimeValue(playerStats.name, 'currentHitPoints', newHp, campaignName);
    }
    description += ` HP restored: ${currentHp} → ${newHp}.`;
    return description;
}

export async function executeReactionManeuver(action, playerStats, campaignName, maneuverName) {
    const maneuver = await findManeuver(maneuverName, playerStats.rules);

    if (!maneuver) {
        return buildManeuverNotFoundPopup(maneuverName, maneuverName);
    }

    const { superiorityDice, hasDiceRemaining } = checkSuperiorityDice(playerStats, campaignName);

    if (!hasDiceRemaining) {
        return buildNoDiceRemainingPopup(maneuver.name);
    }

    if (maneuver.effect === 'melee_attack_reaction') {
        return executeRiposteReaction(maneuver, playerStats, campaignName, superiorityDice);
    }

    const targetInfo = await resolveTarget(campaignName, playerStats.name);
    const target = targetInfo && targetInfo.target;
    const targetName = target ? target.name : null;

    const { dieValue, dieDescription, expendedDie } = rollManeuverDie(maneuver, playerStats, campaignName);
    await expendSuperiorityDie(playerStats, campaignName, expendedDie, superiorityDice);

    const logEntry = {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: maneuver.name,
        description: `Used ${maneuver.name} as a reaction. ${dieDescription} ${maneuver.description}`,
    };

    let description = `<b>${maneuver.name}</b> (Reaction)<br/>${dieDescription}`;

    if (targetName && maneuver.effect !== 'damage_reduction') {
        description += ` Target: ${targetName}.`;
    }

    if (maneuver.effect === 'damage_reduction') {
        description += await applyManeuverDamageReduction(playerStats, campaignName, dieValue);
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: maneuver.name,
            description,
        },
        logEntries: [logEntry],
    };
}

// ── Commanding Presence Reaction ────────────────────────────────────────

// MN-004: reaction-economy round latch (CLA-383 Warding Flare shape) — stamped
// when the forced save is offered (reaction spent), re-armed at round wrap via
// PLAYER_ROUND_LATCH_KEYS + Initiative.jsx clearPlayerRoundFlags.
const COMMANDING_PRESENCE_LATCH_KEY = '_Commanding_Presence_usedRound';

function commandingPresenceRefuse(playerStats, featureName, campaignName, description, reason) {
    // MN-003 §5: refusals log directly (modal-returning lanes bypass the
    // logEntries flusher), spend nothing, stamp nothing.
    addEntry(campaignName, {
        type: 'automation',
        characterName: playerStats.name,
        automationType: 'commanding_presence_refused',
        name: featureName,
        description,
        reason,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[executeActionManeuvers:log-error]", e); });
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description,
        },
    };
}

function getCommandingPresenceTargetHp(creature) {
    if (creature.type === 'player') {
        return {
            currentHp: getRuntimeValue(creature.name, 'currentHitPoints') ?? getRuntimeValue(creature.name, 'hitPoints') ?? 0,
            maxHp: getRuntimeValue(creature.name, 'hitPoints') ?? 0,
        };
    }
    return { currentHp: creature.currentHp ?? creature.maxHp, maxHp: creature.maxHp };
}

async function collectCommandingPresenceTargets(cs, playerStats, campaignName, rangeFt) {
    const validTargets = [];
    for (const creature of cs.creatures) {
        if (creature.name === playerStats.name) continue;
        if (await isWithinRange(playerStats.name, creature.name, rangeFt)) {
            validTargets.push({ ...creature, ...getCommandingPresenceTargetHp(creature) });
        }
    }
    return validTargets;
}

async function buildCommandingPresenceTargetModal({ action, auto, maneuver, playerStats, campaignName, maneuverName }) {
    const cs = await getCombatContext(campaignName);
    if (!cs || !cs.creatures || cs.creatures.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: maneuver.name,
                description: `${maneuver.name}: No creatures available to target.`,
            },
        };
    }

    const rangeFt = rangeToFeet(auto.reactionRange || '30_ft');
    const validTargets = await collectCommandingPresenceTargets(cs, playerStats, campaignName, rangeFt);

    if (validTargets.length === 0) {
        return commandingPresenceRefuse(playerStats, maneuver.name, campaignName,
            `${maneuver.name}: No creatures within ${rangeFt} feet to target.`, 'no_target_in_range');
    }

    // MN-020: resolve the 'ability' token at prompt time, never bake at collect.
    const saveDc = buildSaveDc(auto, playerStats);
    const saveType = auto.reactionSaveType || auto.saveType || 'WIS';

    return {
        type: 'modal',
        modalName: 'commandingPresenceReaction',
        payload: {
            title: `${maneuver.name} — Choose Target`,
            targets: validTargets,
            confirmLabel: 'Force Save',
            confirmIcon: 'fa-wand-sparkles',
            featureDescription: `Target must make a ${saveType} save (DC ${saveDc}) or have Disadvantage on their next attack roll.`,
            description: `You use your Reaction to intimidate a creature within 30 feet.`,
            action: action,
            playerStats: playerStats,
            campaignName: campaignName,
            maneuverName: maneuverName,
            onTargetSelected: async (selectedTargetName) => {
                const result = await executeCommandingPresenceReaction({ ...action, automation: { ...auto, targetName: selectedTargetName } }, playerStats, campaignName, maneuverName);
                return result;
            },
            onSkip: async () => {
                // Skipping declines the reaction — nothing was spent (no latch, no die).
                commandingPresenceRefuse(playerStats, maneuver.name, campaignName,
                    `${playerStats.name} declined ${maneuver.name} — no target chosen, Reaction not used.`, 'declined');
            },
        },
    };
}

// MN-004: registered te channel (targetEffectDefinitions.js `disadvantage_next_attack`,
// folded by contextBuilder-sync and consumed by attackPostProcessing) replaces the old
// `activeConditions 'disadvantage'` write — that phantom string had no consumer folding
// it into attack resolution, so the penalty never applied. One expiration clock removes
// the te at the end of the source's next turn (rounds: 2, MA-0711 codification).
async function applyCommandingPresenceDisadvantage(reactionDuration, playerStats, targetName, campaignName) {
    const storedEffects = [...(getRuntimeValue('campaign', 'targetEffects', campaignName) || [])];
    const te = {
        effect: 'disadvantage_next_attack',
        target: targetName,
        source: playerStats.name,
        duration: reactionDuration || 'until_end_of_next_turn',
        appliedRound: getCurrentCombatRound(campaignName),
        timestamp: Date.now(),
    };
    const teIndex = storedEffects.findIndex(
        other => other.effect === 'disadvantage_next_attack' && other.target === targetName && other.source === playerStats.name
    );
    if (teIndex === -1) {
        storedEffects.push(te);
    } else {
        storedEffects[teIndex] = te;
    }
    await setRuntimeValue('campaign', 'targetEffects', storedEffects, campaignName);

    await addExpiration({ attackerName: playerStats.name, targetName, effects: [
        { type: 'remove_target_effect', effectKey: 'disadvantage_next_attack', source: playerStats.name },
    ], campaignName, rounds: 2 });

    addEntry(campaignName, {
        type: 'condition',
        characterName: targetName,
        action: 'applied',
        condition: 'Disadvantage on next attack roll',
        reason: `${playerStats.name}'s Commanding Presence (failed Wisdom save)`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[executeActionManeuvers:log-error]", e); });

    return ` ${targetName} has Disadvantage on their next attack roll (until the end of ${playerStats.name}'s next turn).`;
}

// MN-004: the die was already spent on the triggering skill check — this reaction
// is free reaction economy (RAW 2024 Battle Master). No rollManeuverDie /
// expendSuperiorityDie / checkSuperiorityDice here; a second expend drained the
// pool by 2 for one maneuver and gated the reaction behind stale dice state.
export async function executeCommandingPresenceReaction(action, playerStats, campaignName, maneuverName) {
    const maneuver = await findManeuver(maneuverName, playerStats.rules);

    if (!maneuver) {
        return buildManeuverNotFoundPopup(maneuverName, maneuverName);
    }

    const featureName = action.name || `${maneuver.name} (Reaction)`;
    const currentRound = getCurrentCombatRound(campaignName);
    const usedRound = getRuntimeValue(playerStats.name, COMMANDING_PRESENCE_LATCH_KEY, campaignName);
    if (usedRound === currentRound) {
        return commandingPresenceRefuse(playerStats, featureName, campaignName,
            `${featureName} has already been used this round — a Reaction can only be taken once per round. It re-arms when the next round begins.`,
            'already_used_this_round');
    }

    const auto = action.automation || {};
    const targetName = auto.targetName;

    // If no target is pre-set, show a modal to select one
    if (!targetName) {
        return buildCommandingPresenceTargetModal({ action, auto, maneuver, playerStats, campaignName, maneuverName });
    }

    const rangeFt = rangeToFeet(auto.reactionRange || '30_ft');
    const inRange = await isWithinRange(playerStats.name, targetName, rangeFt);
    if (!inRange) {
        return commandingPresenceRefuse(playerStats, featureName, campaignName,
            `${targetName} is out of range — ${maneuver.name} requires a creature within ${rangeFt} feet.`,
            'no_target_in_range');
    }

    // Stamp BEFORE the forced save is offered: the reaction is spent at this moment,
    // and consumers must observe the latch (MN-003 stamp-then-await shape).
    await setRuntimeValue(playerStats.name, COMMANDING_PRESENCE_LATCH_KEY, currentRound, campaignName);

    const saveDc = buildSaveDc(auto, playerStats);
    const saveType = auto.reactionSaveType || auto.saveType || 'WIS';

    const { promise } = createSaveListener(campaignName, { targetName, saveType, saveDc });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: featureName,
        description: `${playerStats.name} used ${maneuver.name} as a Reaction — ${targetName} must make a ${saveType} save (DC ${saveDc}) or have Disadvantage on their next attack roll.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[executeActionManeuvers:log-error]", e); });

    const saveResult = await promise;

    let description = `<b>${maneuver.name}</b> (Reaction)<br/>Target: ${targetName}.`;
    if (saveResult.success) {
        description += ` ${targetName} succeeded their ${saveType} save (DC ${saveDc}) — no effect.`;
    } else {
        description += await applyCommandingPresenceDisadvantage(auto.reactionDuration, playerStats, targetName, campaignName);
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: maneuver.name,
            description,
        },
    };
}
