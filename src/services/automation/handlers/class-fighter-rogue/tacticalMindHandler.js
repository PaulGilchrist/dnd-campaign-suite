import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { infoPopup } from '../../common/infoPopup.js';

async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const refuse = (reason) => {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${playerName} attempted ${action.name} — refused: ${reason}`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[tacticalMind] Error logging refusal:', e); });
        return infoPopup(action.name, reason, auto);
    };

    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    const isAbilityCheck = lastAttack?.rollType === 'check' || lastAttack?.rollType === 'skill';
    const isPlayerRoll = lastAttack?.attackerName === playerName;

    if (!isAbilityCheck || !isPlayerRoll) {
        return refuse(`No recent ability check found for ${playerName}. This feature can only be used shortly after an ability check.`);
    }

    const { d20, bonus: checkBonus, checkName } = lastAttack;
    const originalTotal = d20 + checkBonus;
    const d10Roll = Math.floor(Math.random() * 10) + 1;
    const modifiedTotal = originalTotal + d10Roll;

    if (d20 === 20) {
        return refuse(`${action.name}: Natural 20 — no bonus needed.`);
    }

    const description = `<b>${action.name}</b><br/>` +
        `${checkName}: d20(${d20}) + ${checkBonus} = ${originalTotal}` +
        ` → +1d10(${d10Roll}) = <b>${modifiedTotal}</b>`;

    // CLA-352: never auto-refill a zeroed pool — spend only real remaining uses.
    const currentUses = Number(getRuntimeValue(playerName, 'secondWindUses', campaignName) ?? 0);

    if (!(currentUses > 0)) {
        return refuse(`${action.name}: No Second Wind uses remaining.`);
    }

    await setRuntimeValue(playerName, 'secondWindUses', currentUses - 1, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name}: +${d10Roll} to ${checkName} (d20 ${d20} + ${checkBonus} = ${originalTotal} → ${modifiedTotal}). Second Wind use expended; if the check still fails the GM restores the use.`,
        d10Roll,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[tacticalMind] Error:", e); });

    return infoPopup(action.name, description, auto);
}

export { handle };
