import { rollExpression } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const isAllyAttack = auto?.allyAttack === true;
    const playerName = playerStats.name;

    if (!isAllyAttack) {
        const wrathActive = getRuntimeValue(playerName, 'wrathOfTheSeaActive', campaignName);

        if (!wrathActive) {
            const maxWS = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.wild_shape || 0;
            const currentWS = Number(getRuntimeValue(playerName, 'wildShapeUses', campaignName) ?? maxWS);

            if (currentWS <= 0) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: action.name,
                        description: `${action.name}: No Wild Shape uses remaining.`,
                        automation: auto,
                    },
                };
            }

            await setRuntimeValue(playerName, 'wildShapeUses', currentWS - 1, campaignName);
            await setRuntimeValue(playerName, 'wrathOfTheSeaActive', true, campaignName);

            await addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: action.name,
                description: `${playerName} activated Wrath of the Sea. Ocean spray emanation active.`,
                timestamp: Date.now(),
            }).catch(() => {});

            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description: `${action.name} activated — ocean spray emanation surrounds you. Subsequent uses as a Bonus Action deal Cold damage.`,
                    automation: auto,
                },
            };
        }
    }

    const wisMod = isAllyAttack
        ? (Number(getRuntimeValue(playerName, 'wrathOfTheSeaWisMod', campaignName)) || 1)
        : (playerStats.abilities?.find(a => a.name === 'Wisdom')?.bonus || 1);

    const diceCount = Math.max(1, wisMod);
    const damageFormula = `${diceCount}d6`;
    const damageResult = rollExpression(damageFormula);

    if (!damageResult) return null;

    const saveDc = isAllyAttack
        ? (Number(getRuntimeValue(playerName, 'wrathOfTheSeaDc', campaignName)) || 0)
        : (8 + (playerStats.abilities?.find(a => a.name === 'Wisdom')?.bonus || 0) + (playerStats.proficiency || 0));

    return {
        type: 'roll',
        payload: {
            rollType: 'damage',
            name: action.name,
            formula: damageFormula,
            total: damageResult.total,
            rolls: damageResult.rolls,
            modifier: damageResult.modifier,
            contextConfig: {
                damageType: 'cold',
                saveDc: saveDc,
                saveType: 'CON',
                dcSuccess: 'none',
                attackerName: playerName,
                conditionInflicted: null,
                shape: auto?.shape || 'emanation',
            },
        },
    };
}
