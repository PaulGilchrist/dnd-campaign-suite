import { addEntry } from '../../../ui/logService.js';
import { checkOncePerTurn, markOncePerTurn } from '../../common/oncePerTurn.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

const INTERNAL_SKILL_CHECK_EVENT = 'internal-skill-check';
// House adjudication DC mirroring the verified base Hide lane (useCharActionsBaseActions.js).
const HIDE_DC = 15;

function findStealthBonus(playerStats) {
    const stealthSkill = (playerStats?.abilities || []).flatMap(a => a.skills || []).find(s => s.name === 'Stealth');
    return stealthSkill?.bonus ?? 0;
}

// CLA-067 Dash: +Speed speed_boost buff (same shape as Dread Ambush / buffHandler dash
// lanes; consumed by charSummaryCalc buffSpeedBonus), removed via name-scoped
// remove_active_buff clock anchored to the character's next turn (same verified anchor
// approximation as Dodge — same-round expiry never fires, playbook §38).
async function grantDashSpeed(action, playerStats, campaignName) {
    const name = playerStats.name;
    const speed = playerStats.speed || 30;
    const storedBuffs = getRuntimeValue(name, 'activeBuffs', campaignName);
    const buffs = Array.isArray(storedBuffs) ? storedBuffs : [];
    const cleaned = buffs.filter(b => !(b.name === action.name && b.effect === 'speed_boost'));
    await setRuntimeValue(name, 'activeBuffs', [
        ...cleaned,
        { name: action.name, effect: 'speed_boost', speedBonus: speed, duration: 'until_end_of_turn' },
    ], campaignName);
    addExpiration({ attackerName: name, targetName: name, effects: [
        { type: 'remove_active_buff', buffName: action.name },
    ], campaignName, rounds: undefined, expireOnCreatureName: name });
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: name,
        abilityName: action.name,
        description: `Dash: Speed doubled ${speed} → ${speed * 2} ft until the end of the turn (+${speed} ft speed_boost).`,
    }).catch((e) => { console.error("[bonusActionChoiceHandler:log-error]", e); });
    return `You take the Dash bonus action. Speed doubled ${speed} → ${speed * 2} ft until the end of the turn.`;
}

// CLA-067 Disengage: self-target no_opportunity_attacks te — mirrors the verified
// Step of the Wind / Tactical Shift lanes (registered te, consumed via
// computeConditionEffects riderCannotOpportunityAttack + "No OA" badge).
async function grantDisengage(action, playerStats, campaignName) {
    const name = playerStats.name;
    const storedEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    await setRuntimeValue('campaign', 'targetEffects', [
        ...storedEffects,
        { target: name, source: action.name, effect: 'no_opportunity_attacks', value: null, duration: 'until_start_of_next_turn' },
    ], campaignName);
    addExpiration({ attackerName: name, targetName: name, effects: [
        { type: 'remove_target_effect', effectKey: 'no_opportunity_attacks', source: action.name, target: name },
    ], campaignName, rounds: undefined, expireOnCreatureName: name });
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: name,
        abilityName: action.name,
        description: `Disengage: movement doesn't provoke Opportunity Attacks until the end of the turn (no_opportunity_attacks).`,
    }).catch((e) => { console.error("[bonusActionChoiceHandler:log-error]", e); });
    return `You take the Disengage bonus action. Your movement doesn't provoke opportunity attacks until the end of the turn.`;
}

// CLA-067 Hide: rolls Dexterity (Stealth) through the verified internal-skill-check
// lane (CharAbilities listener) and, on success vs the house DC, stamps the Invisible
// condition + advantage_on_stealth buff exactly like the verified base Hide lane.
async function grantHide(action, playerStats, campaignName) {
    const name = playerStats.name;
    const stealthBonus = findStealthBonus(playerStats);
    window.dispatchEvent(new CustomEvent(INTERNAL_SKILL_CHECK_EVENT, {
        detail: { skillName: 'Stealth', checkType: 'skill' },
    }));
    await new Promise(resolve => setTimeout(resolve, 50));
    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    const rollTotal = lastAttack?.total;
    const d20Val = lastAttack?.d20 ?? '?';
    const success = rollTotal >= HIDE_DC;
    if (success) {
        const currentConditions = getRuntimeValue(name, 'activeConditions', campaignName) || [];
        const alreadyInvisible = currentConditions.some(c => String(c).toLowerCase() === 'invisible');
        if (!alreadyInvisible) {
            await setRuntimeValue(name, 'activeConditions', [...currentConditions, 'invisible'], campaignName);
        }
        const activeBuffs = getRuntimeValue(name, 'activeBuffs', campaignName) || [];
        if (!activeBuffs.some(b => b.effect === 'advantage_on_stealth')) {
            await setRuntimeValue(name, 'activeBuffs', [...activeBuffs, { name: 'Hide', effect: 'advantage_on_stealth' }], campaignName);
        }
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: name,
            abilityName: action.name,
            description: `Hide: Stealth check ${rollTotal} (d20: ${d20Val} + ${stealthBonus}) vs DC ${HIDE_DC} — Success. Gained the Invisible condition until you attack or take damage.`,
        }).catch((e) => { console.error("[bonusActionChoiceHandler:log-error]", e); });
        return `Hide successful! Dexterity (Stealth) check ${rollTotal} (d20: ${d20Val} + ${stealthBonus}) vs DC ${HIDE_DC} — you gain the Invisible condition until you attack, take damage, or are detected.`;
    }
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: name,
        abilityName: action.name,
        description: `Hide: Stealth check ${rollTotal} (d20: ${d20Val} + ${stealthBonus}) vs DC ${HIDE_DC} — Failure. You remain visible.`,
    }).catch((e) => { console.error("[bonusActionChoiceHandler:log-error]", e); });
    return `Hide failed! Dexterity (Stealth) check ${rollTotal} (d20: ${d20Val} + ${stealthBonus}) vs DC ${HIDE_DC} — you remain visible.`;
}

const OPTION_GRANTS = {
    Dash: grantDashSpeed,
    Disengage: grantDisengage,
    Hide: grantHide,
};

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const options = auto.options || [];

    if (options.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} has no options available.`,
                automation: auto,
            },
        };
    }

    // Check once-per-turn usage
    if (auto.oncePerTurn) {
        const trackingKey = action.name === 'Fast Hands' ? '_FastHands_usedRound' : '_CunningAction_usedRound';
        const skip = await checkOncePerTurn(action.name, trackingKey, playerStats.name, campaignName);
        if (skip) return skip;
    }

    // Present choice modal
    return {
        type: 'modal',
        modalName: 'bonusActionChoice',
        payload: {
            action,
            options,
        },
    };
}

export async function applyBonusActionChoice(action, playerStats, campaignName, chosenOption) {
    const auto = action.automation;
    const option = auto.options?.find(o => o.name === chosenOption);
    if (!option) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Unknown option: ${chosenOption}`,
                automation: auto,
            },
        };
    }

    // Track once-per-turn usage
    if (auto.oncePerTurn) {
        const trackingKey = action.name === 'Fast Hands' ? '_FastHands_usedRound' : '_CunningAction_usedRound';
        await markOncePerTurn(action.name, trackingKey, playerStats, campaignName);
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${chosenOption} selected`,
    }).catch((e) => { console.error("[bonusActionChoiceHandler:log-error]", e); });

    // Apply the chosen effect
    let description;
    const grant = OPTION_GRANTS[chosenOption];
    if (grant) {
        description = await grant(action, playerStats, campaignName);
    }
    else switch (chosenOption) {
        case 'Sleight of Hand':
            description = `You use Fast Hands to make a Dexterity (Sleight of Hand) check — pick pocket, palming a small object, hiding a small item, etc.`;
            break;
        case 'Thieves\' Tools':
            description = `You use Fast Hands to use thieves' tools to pick a lock or disarm a trap.`;
            break;
        case 'Use an Object':
            description = `You use Fast Hands to use an object. Using a magic item that requires an action uses the Utilize action. Normal objects use the standard Action.`;
            break;
        default:
            description = `${action.name}: ${option.description}`;
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${chosenOption} selected: ${description}`,
            automation: auto,
        },
    };
}
