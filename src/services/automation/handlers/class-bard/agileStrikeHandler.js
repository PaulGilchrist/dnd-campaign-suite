import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { rollD20, rollExpression } from '../../../dice/diceRoller.js';
import { addEntry } from '../../../ui/logService.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

export async function handle(action, playerStats, campaignName, _mapName, _characters) {
    const auto = action.automation || action;
    const bardicDie = auto.bardicDie || 6;
    const dieStr = `1d${bardicDie}`;

    const cs = await getCombatContext(campaignName);
    if (!cs) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No combat context available.',
                automation: auto,
            },
        };
    }

    const target = getTargetFromAttacker(cs, playerStats.name);
    const targetName = target?.name || null;

    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No target selected for Agile Strikes. Select an enemy target and try again.',
                automation: auto,
            },
        };
    }

    const dexMod = playerStats.abilities?.find(a => a.name === 'Dexterity')?.bonus || 0;
    const prof = playerStats.proficiency || 0;
    const hitBonus = dexMod + prof;

    const d20 = rollD20();
    const total = d20 + hitBonus;
    const targetAc = target.ac || 15;
    const hit = total >= targetAc;

    const damageRoll = rollExpression(dieStr);
    const damageTotal = (damageRoll?.total || 0) + dexMod;

    if (hit) {
        const characters = getRuntimeValue('characters', 'characters', campaignName) || [];
        applyDamageToTarget(cs, targetName, damageTotal, ['Bludgeoning'], campaignName, characters, false, playerStats.name);
    }

    const hitText = hit ? 'HIT' : 'MISS';
    const damageText = hit ? ` dealt ${damageTotal} Bludgeoning damage` : ' missed — no damage';

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} used ${action.name} on ${targetName}: d20(${d20}) + ${hitBonus} = ${total} vs AC ${targetAc} → ${hitText}. BI die (${dieStr}) + ${dexMod} = ${damageTotal}.${damageText}`,
        timestamp: Date.now(),
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${playerStats.name} made an Unarmed Strike against ${targetName}: d20(${d20}) + ${hitBonus} = ${total} vs AC ${targetAc} → ${hitText}. BI die (${dieStr}) + ${dexMod} = ${damageTotal}.${damageText}`,
            automation: auto,
        },
    };
}
