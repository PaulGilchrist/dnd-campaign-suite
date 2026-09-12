import { rollExpression } from '../../../services/dice/diceRoller.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';

export async function handleOverchannelSelfDamage(characterName, campaignName, context, logEntry, characters) {
    if (context?.overchannelActive) {
        if (context?.overchannelUseCount > 1) {
            const overchannelSpellLevel = context?.overchannelSpellLevel || 1;
            const dicePerLevel = 2 + (context.overchannelUseCount - 1);
            const totalDice = dicePerLevel * overchannelSpellLevel;
            const necroticFormula = `${totalDice}d12`;
            const necroticResult = rollExpression(necroticFormula);
            if (necroticResult) {
                const casterCombatSummary = getCombatSummary(campaignName);
                const casterApplyResult = await applyDamageToTarget(casterCombatSummary, characterName, necroticResult.total, ['Necrotic'], campaignName, characters, { ignoreResistance: true, attackerName: characterName });
                logEntry({
                    type: 'roll',
                    characterName,
                    rollType: 'overchannel-damage',
                    name: 'Overchannel',
                    formula: necroticFormula,
                    rolls: necroticResult.rolls,
                    total: necroticResult.total,
                    modifier: necroticResult.modifier,
                    damageType: 'Necrotic',
                    targetName: characterName,
                    finalDamage: casterApplyResult?.finalDamage ?? necroticResult.total,
                    note: 'Overchannel self-damage (ignores resistance/immunity)',
                });
            }
        }
    }
}
