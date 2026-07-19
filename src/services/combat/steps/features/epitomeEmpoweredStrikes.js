import { rollExpression } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';

export const epitomeEmpoweredStrikes = {
    name: 'epitomeEmpoweredStrikes',
    condition: (ctx) => {
        const epitomeActive = getRuntimeValue(ctx.playerStats.name, 'elementalEpitomeActive', ctx.campaignName);
        if (!epitomeActive) return false;
        return ctx.attack?.weaponType === 'unarmed';
    },
    handler: async (ctx, prevData) => {
        const round = getCurrentCombatRound();
        const usedRound = getRuntimeValue(ctx.playerStats.name, 'epitomeEmpoweredUsedRound', ctx.campaignName);
        if (usedRound === round) return { data: prevData };

        const classLevel = ctx.playerStats.class?.class_levels?.find(cl => cl.level === ctx.playerStats.level);
        const martialArtsDie = classLevel?.martial_arts_die || 4;

        const r = rollExpression(`1d${martialArtsDie}`);
        if (!r) return { data: prevData };

        return {
            data: {
                formula: `${prevData.formula} + 1d${martialArtsDie} [Empowered Strikes]`,
                total: prevData.total + r.total,
                rolls: [...prevData.rolls, ...r.rolls],
            },
            sideEffects: async () => {
                await setRuntimeValue(ctx.playerStats.name, 'epitomeEmpoweredUsedRound', round, ctx.campaignName);
                await addEntry(ctx.campaignName, {
                    type: 'ability_use',
                    characterName: ctx.playerStats.name,
                    abilityName: 'Elemental Epitome - Empowered Strikes',
                    description: `${ctx.playerStats.name}'s Unarmed Strike deals +1d${martialArtsDie} damage (Empowered Strikes) against ${ctx.targetName || 'target'}.`,
                    targetName: ctx.targetName,
                    timestamp: Date.now(),
                }).catch(() => {});
            },
        };
    },
};
