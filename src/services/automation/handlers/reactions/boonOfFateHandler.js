import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { applyD20Modifier } from './reactionBonusHandler.js';
import { infoPopup } from '../../common/infoPopup.js';

const RANGE_FT = 60;

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const boonKey = 'boonOfFateUsed';

    const boonUsed = getRuntimeValue(playerName, boonKey, campaignName);
    if (boonUsed) {
        return infoPopup(action.name, `${action.name} has no uses remaining. Recharges on Initiative or Short or Long Rest.`, auto);
    }

    const cs = await getCombatContext(campaignName);
    const lastAttack = cs?.lastAttack || null;

    if (!lastAttack) {
        return infoPopup(action.name, `${action.name}: No recent D20 test found. This feature can only be used shortly after a creature rolls a d20.`, auto);
    }

    const attackerName = lastAttack.attackerName;
    if (!attackerName) {
        return infoPopup(action.name, `${action.name}: No attacker found in recent D20 test.`, auto);
    }

    const inRange = await isWithinRange(playerName, attackerName, RANGE_FT);
    if (!inRange) {
        return infoPopup(action.name, `${action.name}: ${attackerName} is out of range (must be within ${RANGE_FT} ft).`, auto);
    }

    const roll2d4 = rollExpression('2d4');
    if (!roll2d4) {
        return infoPopup(action.name, `${action.name}: Roll failed.`, auto);
    }

    const rollType = lastAttack.rollType || 'attack';
    const isAttack = rollType === 'attack';
    const isSave = rollType === 'save' || (rollType === 'attack' && lastAttack.saveDc != null && lastAttack.saveResult != null);
    const isCheck = rollType === 'check' || rollType === 'skill';

    let eventLabel;
    if (isAttack) {
        eventLabel = `Attack by ${attackerName}`;
    } else if (isCheck) {
        eventLabel = `${lastAttack.checkName || 'Ability check'} by ${attackerName}`;
    } else {
        const saveLabel = lastAttack.saveType ? lastAttack.saveType.toUpperCase() : 'Save';
        eventLabel = `${saveLabel} by ${attackerName}`;
    }

    const originalTotal = (lastAttack.d20 || 0) + (lastAttack.bonus || 0);
    const hitStatus = isAttack && lastAttack.targetAc != null
        ? (originalTotal >= lastAttack.targetAc ? 'Hit' : 'Miss')
        : null;
    const saveStatus = isSave && lastAttack.saveDc != null
        ? (originalTotal >= lastAttack.saveDc ? 'Success' : 'Failure')
        : null;

    return {
        type: 'modal',
        modalName: 'boonFateChoice',
        payload: {
            action,
            playerStats,
            campaignName,
            roll2d4,
            lastAttack,
            attackerName,
            eventLabel,
            hitStatus,
            saveStatus,
            isAttack,
            isSave,
            isCheck,
        },
    };
}

export async function applyBoonFateChoice(action, playerStats, campaignName, roll2d4, lastAttack, mode) {
    const playerName = playerStats.name;
    const diceValue = typeof roll2d4 === 'object' ? roll2d4.total : roll2d4;

    await setRuntimeValue(playerName, 'boonOfFateUsed', true, campaignName);

    return applyD20Modifier(action, playerName, campaignName, diceValue, lastAttack, mode, {
        featureName: action.name || 'Improve Fate',
        onSpent: () => {},
    });
}
