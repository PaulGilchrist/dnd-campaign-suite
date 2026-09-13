import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';

const FEIGN_DEATH_CONDITIONS = ['blinded', 'incapacitated', 'speed_zero'];
const FEIGN_DEATH_RESISTANCES = [
    'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
    'necrotic', 'piercing', 'poison', 'radiant', 'slashing', 'thunder',
];
const FEIGN_DEATH_CONDITION_IMMUNITY = ['poisoned'];

function getFeignDeathDuration(spell) {
    return spell.duration || '1 hour';
}

export async function handle(action, playerStats, campaignName, _mapName, _characters) {
    const spell = action.spell || {};

    const rangeFt = rangeToFeet(spell.range || 'Touch');

    const positions = _mapName ? await resolveMapPositions(campaignName, _mapName, playerStats.name) : null;
    const attackerPos = positions?.attackerPos || null;

    const combatSummary = getCombatSummary(campaignName);
    const allCreatures = combatSummary?.creatures || [];

    const creatureTargets = allCreatures.map(c => c.name);

    return {
        type: 'modal',
        modalName: 'feignDeathTargetSelection',
        payload: {
            name: action.name,
            creatureTargets,
            range: spell.range || 'Touch',
            rangeFt,
            duration: getFeignDeathDuration(spell),
            attackerPos,
        },
    };
}

async function applyFeignDeathToTarget(action, sourceName, targetName, campaignName, duration) {
    const activeBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    const buffs = Array.isArray(activeBuffs) ? activeBuffs : [];
    if (!buffs.some(b => b.name === action.name)) {
        const buff = {
            name: action.name,
            effect: 'feign_death',
            duration,
            resistanceTypes: FEIGN_DEATH_RESISTANCES,
            conditionImmunity: FEIGN_DEATH_CONDITION_IMMUNITY,
            sourceCharacter: sourceName,
        };
        buffs.push(buff);
        setRuntimeValue(targetName, 'activeBuffs', buffs, campaignName);
    }

    applyFeignDeathConditions(targetName, campaignName);

    const currentConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    if (Array.isArray(currentConditions)) {
        const filtered = currentConditions.filter(c => String(c).toLowerCase() !== 'poisoned');
        if (filtered.length !== currentConditions.length) {
            setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
        }
    }

    addExpiration({ attackerName: sourceName, targetName, effects: [
        { type: 'remove_feign_death_buff', buffName: action.name },
    ], campaignName, rounds: undefined, expireOnCreatureName: targetName });

    const isSelf = targetName === sourceName;
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: sourceName,
        abilityName: action.name,
        description: `${sourceName} cast ${action.name} on ${isSelf ? 'themself' : targetName}. Target appears dead: Blinded, Incapacitated, Speed 0, Resistant to all damage except Psychic, Immune to Poisoned. Expires on initiative roll, short rest, or long rest.`,
    }).catch((e) => { console.error('[feignDeath] Error logging:', e); });
}

export async function applyFeignDeath(action, playerStats, campaignName, _mapName, targetNames) {
    if (!Array.isArray(targetNames) || targetNames.length === 0) {
        return null;
    }

    const spell = action.spell || {};
    const duration = getFeignDeathDuration(spell);
    const sourceName = playerStats.name;
    const targets = [];

    for (const targetName of targetNames) {
        await applyFeignDeathToTarget(action, sourceName, targetName, campaignName, duration);
        targets.push(targetName);
    }

    const targetsList = targets.length === 1 ? targets[0] : targets.join(', ');
    const description = targets.length === 1
        ? `${sourceName} cast ${action.name} on ${isSelfOrTarget(targets[0], sourceName) ? 'themself' : targets[0]}. Target appears dead: Blinded, Incapacitated, Speed 0, Resistant to all damage except Psychic, Immune to Poisoned.`
        : `${sourceName} cast ${action.name} on ${targetsList}. Targets appear dead: Blinded, Incapacitated, Speed 0, Resistant to all damage except Psychic, Immune to Poisoned.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description,
        },
    };
}

function isSelfOrTarget(targetName, sourceName) {
    return targetName === sourceName;
}

function applyFeignDeathConditions(targetName, campaignName) {
    const currentConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(currentConditions) ? currentConditions : [];
    const updated = [...conditions];
    for (const cond of FEIGN_DEATH_CONDITIONS) {
        if (!updated.some(c => String(c).toLowerCase() === cond)) {
            updated.push(cond);
        }
    }
    setRuntimeValue(targetName, 'activeConditions', updated, campaignName);
}
