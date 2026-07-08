import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

export const remarkableAthlete = {
  name: 'remarkableAthlete',
  condition: (ctx) => {
    return ctx.isCrit && (ctx.playerStats?.automation?.passives || []).some(p => p.type === 'auto_effect' && p.effect === 'remarkable_athlete_movement');
  },
  handler: async (ctx, prevData) => {
    setRuntimeValue(ctx.playerStats.name, 'remarkableAthleteNoOA', true, ctx.campaignName);
    return { data: prevData };
  },
};
