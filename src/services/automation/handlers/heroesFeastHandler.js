import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../rules/effects/expirations.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';
import { evaluateAutoExpression } from '../../combat/automation/automationExpressions.js';
import { postLogEntry } from '../../shared/logPoster.js';

const HEROES_FEAST_BUFF_NAME = "Heroes' Feast";
const HEROES_FEAST_HP_KEY = 'heroesFeastHpMaxIncrease';

function getHpMaxIncrease(slotLevel) {
    const expr = '2d10';
    const prof = 0;
    const level = slotLevel || 6;
    const resolvedSlot = slotLevel || 6;
    const amount = evaluateAutoExpression(expr, { level, proficiency: prof }, prof, level, resolvedSlot);
    return typeof amount === 'number' && amount > 0 ? amount : 11;
}

function getDuration() {
    return '24 hours';
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const slotLevel = action.spellSlotLevel || 6;

    const maxTargets = auto.maxTargets || 12;
    const hpIncrease = getHpMaxIncrease(slotLevel);

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No combat context found. Cannot apply ${action.name}.`,
            },
        };
    }

    const creatureTargets = combatSummary.creatures
        .filter(c => c.name !== playerStats.name)
        .map(c => c.name);

    return {
        type: 'popup',
        payload: {
            type: 'heroes_feast_target_selection',
            name: action.name,
            creatureTargets,
            maxTargets,
            hpIncrease,
            duration: getDuration(),
            automation: auto,
        },
    };
}

export async function applyHeroesFeast(action, playerStats, campaignName, mapName, targetNames) {
    if (!targetNames || !Array.isArray(targetNames) || targetNames.length === 0) {
        return null;
    }

    const slotLevel = action.spellSlotLevel || 6;
    const hpIncrease = getHpMaxIncrease(slotLevel);
    const duration = getDuration();

    for (const targetName of targetNames) {
        const stored = getRuntimeValue(targetName, HEROES_FEAST_HP_KEY, campaignName);
        const currentIncrease = Number(stored) || 0;
        const newIncrease = currentIncrease + hpIncrease;
        setRuntimeValue(targetName, HEROES_FEAST_HP_KEY, newIncrease, campaignName);

        const baseHp = getRuntimeValue(targetName, 'hitPoints', campaignName);
        const newBaseHp = baseHp + hpIncrease;
        setRuntimeValue(targetName, 'hitPoints', newBaseHp, campaignName);

        const storedCurrentHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
        if (storedCurrentHp != null) {
            const currentHp = Number(storedCurrentHp);
            const newCurrentHp = Math.min(newBaseHp, currentHp + hpIncrease);
            setRuntimeValue(targetName, 'currentHitPoints', newCurrentHp, campaignName);
        }

        addExpiration(playerStats.name, targetName, [
            { type: 'remove_heroes_feast_buff', buffName: HEROES_FEAST_BUFF_NAME, hpKey: HEROES_FEAST_HP_KEY }
        ], campaignName);

        const feastBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
        const buffs = Array.isArray(feastBuffs) ? feastBuffs : [];
        const existingFeast = buffs.some(b => b.name === HEROES_FEAST_BUFF_NAME);
        if (!existingFeast) {
            buffs.push({
                name: HEROES_FEAST_BUFF_NAME,
                effect: 'heroes_feast',
                duration,
                sourceCharacter: playerStats.name,
                resistanceTypes: ['Poison'],
                conditionImmunity: ['Frightened', 'Poisoned'],
            });
            setRuntimeValue(targetName, 'activeBuffs', buffs, campaignName);
        }

        postLogEntry(campaignName, {
            type: 'hp_change',
            targetName,
            delta: hpIncrease,
            isHealing: true,
            sourceName: playerStats.name,
            note: `${action.name} (+${hpIncrease} HP max)`,
        });
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${targetNames.length} target(s) gained +${hpIncrease} HP maximum, Poison resistance, and Immunity to Frightened and Poisoned conditions from ${action.name}.`,
        },
    };
}
