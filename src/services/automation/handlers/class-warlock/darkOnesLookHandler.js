import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { infoPopup } from '../../common/infoPopup.js';

function buildDescription(action, d20, bonus, label, dieRoll) {
    const originalTotal = d20 + bonus;
    const modifiedTotal = d20 + bonus + dieRoll;

    return `<b>${action.name}</b><br/>` +
        `${label}: d20(${d20}) + ${bonus} = ${originalTotal}` +
        ` → Modified: d20(${d20}) + ${bonus} + 1d10(${dieRoll}) = <b>${modifiedTotal}</b>`;
}

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Calculate max uses: CHA modifier (minimum 1)
    const chaMod = evaluateAutoExpression('CHA modifier', playerStats);
    const maxUses = Math.max(1, chaMod);

    // Check remaining uses
    const currentUses = Number(getRuntimeValue(playerName, 'darkOnesLookUses', campaignName) ?? maxUses);

    if (currentUses <= 0) {
        return infoPopup(action.name, `${action.name} has no uses remaining. Recharges on a Long Rest.`, auto);
    }

    // Find the most recent ability check or saving throw by this player
    const cs = await getCombatContext(campaignName);
    const lastAttack = cs?.lastAttack || null;
    const isPlayerRoll = lastAttack?.attackerName === playerName;
    const abilityFresh = isPlayerRoll && (lastAttack?.rollType === 'check' || lastAttack?.rollType === 'skill');
    const saveFresh = isPlayerRoll && lastAttack?.rollType === 'save';

    if (!abilityFresh && !saveFresh) {
        return infoPopup(action.name, `No recent ability check or saving throw found for ${playerName}. This feature can only be used shortly after an ability check or saving throw.`, auto);
    }

    // Roll 1d10
    const dieRoll = Math.floor(Math.random() * 10) + 1;

    let description;

    if (abilityFresh) {
        const { d20, bonus, checkName } = lastAttack;
        description = buildDescription(action, d20, bonus, checkName, dieRoll);
    } else {
        const { d20, bonus, saveType } = lastAttack;
        const saveLabel = saveType ? saveType.toUpperCase() : 'Save';
        description = buildDescription(action, d20, bonus, saveLabel, dieRoll);
    }

    // Consume one use
    await setRuntimeValue(playerName, 'darkOnesLookUses', currentUses - 1, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name}: +1d10(${dieRoll}) to ability check/saving throw. Uses remaining: ${currentUses - 1}/${maxUses}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[darkOnesLook] Error:", e); throw e; });

    return infoPopup(action.name, description, auto);
}
