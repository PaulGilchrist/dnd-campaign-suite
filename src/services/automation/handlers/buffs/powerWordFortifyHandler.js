import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { rollExpression } from '../../../dice/diceRoller.js';

const POWER_WORD_FORTIFY_NAME = 'Power Word Fortify';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const maxTargets = auto?.maxTargets || 6;
    const rangeFt = auto?.range ? rangeToFeet(auto.range) : 60;
    const tempHpExpression = resolveTempHpExpression(auto, playerStats);

    const result = rollExpression(tempHpExpression);
    if (!result) {
        return {
            type: 'popup',
            payload: { type: 'automation_info', name: POWER_WORD_FORTIFY_NAME, description: `${POWER_WORD_FORTIFY_NAME} failed to roll temporary HP.` },
        };
    }

    const totalTempHp = result.total;
    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return null;
    }

    const allyNames = getAllyList(playerName);
    const eligible = [];

    for (const allyName of allyNames) {
        if (allyName === playerName) continue;
        const creature = combatSummary.creatures?.find(c => c.name === allyName);
        if (!creature) continue;
        if (await isWithinRange(playerName, allyName, rangeFt)) {
            eligible.push(creature);
        }
    }

    if (eligible.length === 0) {
        return {
            type: 'popup',
            payload: { type: 'automation_info', name: POWER_WORD_FORTIFY_NAME, description: `${POWER_WORD_FORTIFY_NAME}: No allies within range.` },
        };
    }

    if (eligible.length <= maxTargets) {
        return confirmPowerWordFortify(action, playerStats, campaignName, eligible, totalTempHp, tempHpExpression);
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

export async function confirmPowerWordFortify(action, playerStats, campaignName, selectedTargetNames, totalTempHp, tempHpExpression) {
    const playerName = playerStats.name;
    const maxTargets = action.automation?.maxTargets || 6;
    const finalTargets = selectedTargetNames.slice(0, maxTargets);

    const perTarget = Math.floor(totalTempHp / finalTargets.length);
    let remaining = totalTempHp - (perTarget * finalTargets.length);
    const results = [];

    for (const targetName of finalTargets) {
        const currentTempHp = Number(getRuntimeValue(targetName, 'tempHp', campaignName) ?? 0);
        const grantAmount = perTarget + (remaining > 0 ? 1 : 0);
        if (remaining > 0) remaining--;

        const newTempHp = currentTempHp + grantAmount;
        await setRuntimeValue(targetName, 'tempHp', newTempHp, campaignName);

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

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: POWER_WORD_FORTIFY_NAME,
            automationType: action.automation.type,
            description: `${POWER_WORD_FORTIFY_NAME} granted ${totalTempHp} temporary HP to ${finalTargets.length} target(s): ${finalTargets.join(', ') || 'none'}.`,
        },
    };
}
