import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationExpressions.js';
import { postLogEntry } from '../../../shared/logPoster.js';

const AID_BUFF_NAME = 'Aid';

function getAidHpMaxIncrease(spell, slotLevel) {
    const expr = spell.automation?.hpMaxIncreaseExpression || '5';
    const prof = 0;
    const level = spell.level || 2;
    const resolvedSlot = slotLevel || spell.level || 2;
    const amount = evaluateAutoExpression(expr, { level, proficiency: prof }, prof, level, resolvedSlot);
    return typeof amount === 'number' && amount > 0 ? amount : 5;
}

function getAidDuration(spell) {
    return spell.duration || '8 hours';
}

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation || {};
    const spell = action.spell || {};
    const slotLevel = action.spellSlotLevel || spell.level || 2;

    const rangeFt = rangeToFeet(auto.range || spell.range || '30 feet');
    const maxTargets = auto.maxTargets || 3;
    const hpIncrease = getAidHpMaxIncrease(spell, slotLevel);

    const positions = mapName ? await resolveMapPositions(campaignName, mapName, playerStats.name) : null;
    const attackerPos = positions?.attackerPos || null;

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
            type: 'aid_target_selection',
            name: action.name,
            creatureTargets,
            range: auto.range || spell.range || '30 feet',
            rangeFt,
            maxTargets,
            hpIncrease,
            duration: getAidDuration(spell),
            attackerPos,
            automation: auto,
        },
    };
}

export async function applyAid(action, playerStats, campaignName, mapName, targetNames) {
    if (!targetNames || !Array.isArray(targetNames) || targetNames.length === 0) {
        return null;
    }

    const spell = action.spell || {};
    const slotLevel = action.spellSlotLevel || spell.level || 2;
    const hpIncrease = getAidHpMaxIncrease(spell, slotLevel);
    const duration = getAidDuration(spell);

    for (const targetName of targetNames) {
        const stored = getRuntimeValue(targetName, 'aidHpMaxIncrease', campaignName);
        const currentIncrease = Number(stored) || 0;
        const newIncrease = currentIncrease + hpIncrease;
        setRuntimeValue(targetName, 'aidHpMaxIncrease', newIncrease, campaignName);

        const storedCurrentHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName);
        const baseHp = getRuntimeValue(targetName, 'hitPoints', campaignName);
        if (storedCurrentHp != null) {
            const currentHp = Number(storedCurrentHp);
            const newCurrentHp = Math.min(baseHp + newIncrease, currentHp + hpIncrease);
            setRuntimeValue(targetName, 'currentHitPoints', newCurrentHp, campaignName);
        }

        addExpiration(playerStats.name, targetName, [
            { type: 'remove_aid_buff', buffName: AID_BUFF_NAME, hpKey: 'aidHpMaxIncrease' }
        ], campaignName);

        const aidBuff = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
        const buffs = Array.isArray(aidBuff) ? aidBuff : [];
        const existingAid = buffs.some(b => b.name === AID_BUFF_NAME);
        if (!existingAid) {
            buffs.push({
                name: AID_BUFF_NAME,
                effect: 'aid_hp_increase',
                duration,
                sourceCharacter: playerStats.name,
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
            description: `${targetNames.length} target(s) gained +${hpIncrease} HP maximum from ${action.name}.`,
        },
    };
}
