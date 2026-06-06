import { rollExpression } from '../../diceRoller.js';
import { buildSaveDc } from '../common/savePrompt.js';

export async function handle(action, playerStats, _campaignName, _mapName) {
    const auto = action.automation;

    const damageResult = rollExpression(auto.damage);
    if (!damageResult) return null;

    const dcSuccess = auto.shape === 'cone' ? 0.5 : 0;
    const saveDcValue = buildSaveDc(auto, playerStats);

    return {
        type: 'roll',
        payload: {
            rollType: 'damage',
            name: action.name,
            formula: auto.damage,
            total: damageResult.total,
            rolls: damageResult.rolls,
            modifier: damageResult.modifier,
            contextConfig: {
                damageType: auto.damageType || '',
                saveDc: saveDcValue,
                saveType: auto.saveType || 'DEX',
                dcSuccess,
                attackerName: playerStats.name,
             },
         },
     };
 }
