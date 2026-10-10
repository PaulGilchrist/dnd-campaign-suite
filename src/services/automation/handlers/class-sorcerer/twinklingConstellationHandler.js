import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary, getActiveCreatureName, getCurrentCombatRound } from '../../../encounters/combatData.js';
import { addExpiration } from '../../../rules/effects/expirationQueue.js';

const CONSTELLATION_OPTIONS = ['Archer', 'Chalice', 'Dragon'];

// CLA-368: once-per-turn press latch (CLA-346 recipe) — stamped at chooser
// open, re-armed at round wrap via navigationHandlers PLAYER_ROUND_LATCH_KEYS
// and Initiative.jsx combat reset.
const TURN_LATCH_KEY = '_Twinkling_Constellations_usedRound';

// CLA-368: the switch is only legal while Starry Form is active — read the
// stamp the Starry Form lane writes (same check as starryFormHandler.js:27).
function isStarryFormActive(playerName, campaignName) {
    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    if (activeBuffs.some(b => b.name === 'Starry Form' && b.constellation)) return true;
    const storedEffects = getRuntimeValue('campaign', 'targetEffects');
    const tes = Array.isArray(storedEffects) ? storedEffects : [];
    return tes.some(te => te.effect === 'starry_form' && te.source === playerName && te.target === playerName);
}

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const level = playerStats.level || 1;
    const isTwinkled = level >= 10;

    const refusal = (reason) => ({
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: auto.type,
            description: `${action.name}: ${reason}`,
            automation: auto,
        },
    });

    const logRefusal = (reason) => {
        addEntry(campaignName, {
            type: 'automation',
            characterName: playerName,
            automationType: 'twinkling_constellations_refused',
            name: action.name,
            description: `${action.name} refused — ${reason}`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[twinklingConstellationHandler:log-error]", e); });
    };

    if (!isTwinkled) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Twinkling Constellations requires level 10.`,
                automation: action.automation,
            },
        };
    }

    // CLA-368: Starry Form prerequisite gate — never open the chooser (and
    // never bootstrap the constellation benefit) without an active Starry Form.
    if (!isStarryFormActive(playerName, campaignName)) {
        const reason = 'Starry Form is not active. Assume Starry Form first.';
        await logRefusal(reason);
        return refusal(reason);
    }

    // CLA-368: RAW switch only at the start of your own turn. Top-level
    // activeCreatureName is truth (CLA-044). Outside initiative there is no
    // turn context — allowed with an advisory note (GM-enforced family).
    const cs = getCombatSummary(campaignName);
    const currentCreature = getRuntimeValue('campaign', 'activeCreatureName', campaignName) || getActiveCreatureName(campaignName);
    if (!cs && !currentCreature) {
        addEntry(campaignName, {
            type: 'automation',
            characterName: playerName,
            automationType: 'twinkling_constellations_advisory',
            name: action.name,
            description: `${action.name}: no initiative context — the start-of-your-turn switch is advisory outside combat.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[twinklingConstellationHandler:log-error]", e); });
        return {
            type: 'modal',
            modalName: 'twinklingConstellation',
            payload: { action, playerStats, campaignName },
        };
    }

    if (currentCreature && currentCreature !== playerName) {
        const reason = `You can only change constellation at the start of your turn — it is ${currentCreature}'s turn.`;
        await logRefusal(reason);
        return refusal(reason);
    }

    const round = getCurrentCombatRound(campaignName);
    const latchRound = Number(getRuntimeValue(playerName, TURN_LATCH_KEY, campaignName) ?? 0);
    if (latchRound >= round) {
        const reason = 'You have already changed constellation this turn.';
        await logRefusal(reason);
        return refusal(reason);
    }
    setRuntimeValue(playerName, TURN_LATCH_KEY, round, campaignName);

    return {
        type: 'modal',
        modalName: 'twinklingConstellation',
        payload: { action, playerStats, campaignName },
    };
}

export async function applyConstellationOption(action, playerStats, campaignName, optionName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const isTwinkled = (playerStats.level || 1) >= 10;

    if (!CONSTELLATION_OPTIONS.includes(optionName)) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `Invalid constellation: ${optionName}`,
                automation: auto,
            },
        };
    }

    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];

    const buffEntry = {
        name: 'Starry Form',
        effect: 'starry_form',
        constellation: optionName,
        duration: '1_minute',
        hasAutomation: true,
        resistanceTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
    };

    if (optionName === 'Dragon' && isTwinkled) {
        buffEntry.effect = 'fly_speed_20_hover';
        buffEntry.flySpeed = 20;
    }

    // Build a NEW array (never splice the store's own reference): in-place
    // mutation makes setRuntimeValue's dirty-check see the same reference and
    // silently skip the POST (CLA-368).
    const newBuffs = [...activeBuffs.filter(b => b.name !== 'Starry Form'), buffEntry];
    await setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    const storedEffects = getRuntimeValue('campaign', 'targetEffects');
    const allTargetEffects = Array.isArray(storedEffects) ? storedEffects : [];
    const starryTargetEffect = {
        effect: 'starry_form',
        source: playerName,
        target: playerName,
        constellation: optionName,
        duration: '1_minute',
    };
    const newTargetEffects = [...allTargetEffects.filter(te => te.effect !== 'starry_form' || te.source !== playerName), starryTargetEffect];
    setRuntimeValue('campaign', 'targetEffects', newTargetEffects, campaignName, true);

    // CLA-368: '1_minute' stamp needs a clock — ONE merged addExpiration
    // (playbook §37: 1 minute = 10 rounds), anchorless (§38: long buffs drop
    // the anchor). Cleanup byte-shape matches the stamps written above.
    addExpiration({
        attackerName: playerName,
        targetName: playerName,
        effects: [
            { type: 'remove_active_buff', buffName: 'Starry Form' },
            { type: 'remove_target_effect', effectKey: 'starry_form', source: playerName, target: playerName },
        ],
        campaignName,
        rounds: 10,
    });

    const optionEffects = [];

    if (optionName === 'Archer') {
        const damageDice = isTwinkled ? '2d8' : '1d8';
        optionEffects.push(`Ranged Spell Attack: ${damageDice} + Wisdom Modifier Radiant damage`);
    } else if (optionName === 'Chalice') {
        const healDice = isTwinkled ? '2d8' : '1d8';
        optionEffects.push(`Healing Spell Ally Buff: ${healDice} + Wisdom Modifier HP to ally within 30 feet`);
    } else if (optionName === 'Dragon') {
        optionEffects.push('Concentration Benefit: Treat d20 rolls of 9 or lower on Concentration checks/saves as 10');
        if (isTwinkled) {
            optionEffects.push('Fly Speed 20 feet (hover)');
        }
    }

    const description = `${optionName} constellation chosen (Twinkling Constellations). ${optionEffects.join('. ')}.`;

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} changed Starry Form constellation to ${optionName} with Twinkling Constellations. ${optionEffects.join('. ')}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[twinklingConstellationHandler:log-error]", e); });

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
