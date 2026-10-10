import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';

const LATCH_KEY = '_Tavern_Brawler_Push_UsedRound';

export const tavernBrawlerPush = {
  name: 'tavernBrawlerPush',
  condition: (ctx) => {
    return ctx.attack?.weaponType === 'unarmed' && ctx.hit !== false && !!ctx.playerStats.automation?.passives;
  },
  handler: async (ctx, prevData) => {
    const tbPush = (ctx.playerStats.automation?.passives || []).find(p => p.effect === 'tavern_brawler_push');
    if (!tbPush) return null;

    const round = getCurrentCombatRound(ctx.campaignName);
    if (getRuntimeValue(ctx.playerStats.name, LATCH_KEY, ctx.campaignName) === round) {
      addEntry(ctx.campaignName, {
        type: 'automation',
        automationType: 'tavern_brawler_push_refused',
        characterName: ctx.playerStats.name,
        description: `${ctx.playerStats.name}'s Tavern Brawler Push already used this turn — Push refused (once_per_turn).`,
        targetName: ctx.targetName || null,
        timestamp: Date.now(),
      }).catch((e) => { console.error("[tavernBrawlerPush:log-error]", e); });
      return { data: prevData };
    }

    const cs = await getCombatContext(ctx.campaignName);
    const t = cs ? getTargetFromAttacker(cs, ctx.playerStats.name) : null;
    const targetName = t?.name || ctx.targetName || null;
    if (!targetName) return { data: prevData };

    // Latch awaited BEFORE the te write (playbook §39) so a same-tick
    // consumer can never read an unstamped once-per-turn key.
    await setRuntimeValue(ctx.playerStats.name, LATCH_KEY, round, ctx.campaignName);
    const effs = getRuntimeValue('campaign', 'targetEffects', ctx.campaignName) || [];
    // MA-0079 push marker byte-shape: numeric value, instant.
    await setRuntimeValue('campaign', 'targetEffects', [...effs, { target: targetName, source: ctx.playerStats.name, effect: 'push', value: 5, duration: 'instant' }], ctx.campaignName);
    addEntry(ctx.campaignName, {
      type: 'ability_use',
      characterName: ctx.playerStats.name,
      abilityName: 'Tavern Brawler',
      description: `Tavern Brawler Push: ${targetName} pushed 5 feet straight away from ${ctx.playerStats.name} after an Unarmed Strike hit (token position GM-enforced, gridless advisory).`,
      targetName,
      timestamp: Date.now(),
    }).catch((e) => { console.error("[tavernBrawlerPush:log-error]", e); });
    return { data: prevData };
  },
};
