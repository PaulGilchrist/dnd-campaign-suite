import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { setTempHp } from './tempHpService.js';
import { addEntry } from '../../../ui/logService.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { rollExpression } from '../../../dice/diceRoller.js';

const POWER_WORD_FORTIFY_NAME = 'Power Word Fortify';

// Returns { total } on success, or { error: true } when the expression can't produce HP.
function rollFortifyTempHp(expression) {
    const diceMatch = expression.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (diceMatch) {
        const result = rollExpression(expression);
        return result ? { total: result.total } : { error: true };
    }
    const numeric = parseInt(expression, 10);
    return isNaN(numeric) ? { error: true } : { total: numeric };
}

async function collectFortifyEligible(combatSummary, playerName, rangeFt) {
    const allyNames = getAllyList(playerName);
    const allyList = Array.isArray(allyNames) && allyNames.length > 0 ? allyNames : [];
    const effectiveAllies = allyList.length > 0 && allyList.some(a => a !== playerName)
        ? allyList
        : combatSummary.creatures?.map(c => c.name) || [];
    const eligible = [];

    for (const allyName of effectiveAllies) {
        if (allyName === playerName) continue;
        const creature = combatSummary.creatures?.find(c => c.name === allyName);
        if (!creature) continue;
        if (await isWithinRange(playerName, allyName, rangeFt)) {
            eligible.push(creature);
        }
    }
    return eligible;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const maxTargets = auto?.maxTargets || 6;
    const rangeFt = auto?.range ? rangeToFeet(auto.range) : 60;
    const tempHpExpression = resolveTempHpExpression(auto, playerStats);

    const roll = rollFortifyTempHp(tempHpExpression);
    if (roll.error) {
        return {
            type: 'popup',
            payload: { type: 'automation_info', name: POWER_WORD_FORTIFY_NAME, description: `${POWER_WORD_FORTIFY_NAME} failed to roll temporary HP.` },
        };
    }
    const totalTempHp = roll.total;

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return null;
    }

    const eligible = await collectFortifyEligible(combatSummary, playerName, rangeFt);

    if (eligible.length === 0) {
        return {
            type: 'popup',
            payload: { type: 'automation_info', name: POWER_WORD_FORTIFY_NAME, description: `${POWER_WORD_FORTIFY_NAME}: No allies within range.` },
        };
    }

    const creatureTargets = eligible.map(c => ({ name: c.name, type: c.type, currentHp: c.currentHp, maxHp: c.maxHp }));

    return {
        type: 'modal',
        modalName: 'powerWordFortifyTarget',
        payload: {
            action,
            playerStats,
            campaignName,
            creatureTargets,
            maxTargets,
            totalTempHp,
            tempHpExpression,
        },
    };
}

function resolveTempHpExpression(auto, playerStats) {
    if (!auto?.tempHpExpression) {
        return '120';
    }
    const slotLevel = auto.slotLevel || playerStats.level || 7;
    return auto.tempHpExpression.replace(/spellSlotLevel/g, String(slotLevel));
}

export async function confirmPowerWordFortify(action, playerStats, campaignName, distribution, totalTempHp, tempHpExpression) {
    const playerName = playerStats.name;
    const targetNames = Object.keys(distribution);
    const results = [];

    for (const targetName of targetNames) {
        const grantAmount = distribution[targetName];
        if (grantAmount <= 0) continue;

        setTempHp(targetName, grantAmount, campaignName);

        await addEntry(campaignName, {
            type: 'hp_change',
            targetName,
            delta: grantAmount,
            currentHp: null,
            maxHp: null,
            isHealing: false,
            isTempHp: true,
            sourceName: playerName,
            note: POWER_WORD_FORTIFY_NAME,
            formula: tempHpExpression,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[powerWordFortify] Error:', e); });

        results.push({ targetName, tempHpAmount: grantAmount });
    }

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    const breakdown = results.map(r => `${r.targetName}: ${r.tempHpAmount}`).join(', ');
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: POWER_WORD_FORTIFY_NAME,
            automationType: action.automation.type,
            description: `${POWER_WORD_FORTIFY_NAME}: ${totalTempHp} temp HP distributed — ${breakdown || 'none'}.`,
        },
    };
}
