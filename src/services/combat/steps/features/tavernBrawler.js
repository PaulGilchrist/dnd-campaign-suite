
import { addEntry } from '../../../ui/logService.js';

export const tavernBrawler = {
  name: 'tavernBrawler',
  condition: (ctx) => {
    return ctx.attack?.weaponType === 'unarmed' && !!ctx.attack?.damage && !!ctx.playerStats.automation?.passives;
  },
  handler: async (ctx, prevData) => {
    const ps = ctx.playerStats;
    const tb = (ps.automation?.passives || []).find(p => p.effect === 'tavern_brawler_reroll_ones');
    if (!tb) return null;

    const m = ctx.attack.damage.match(/(\d+)d(\d+)/);
    if (!m || prevData.rolls.length === 0) return { data: prevData };

    const ds = parseInt(m[2], 10);
    let total = prevData.total;
    let rolls = [...prevData.rolls];
    let formula = prevData.formula;
    let rerolled = false;
    const rerollPairs = [];

    for (let i = 0; i < rolls.length; i++) {
      if (rolls[i] === 1) {
        const rand = Math.random();
        const rv = Math.floor(rand * ds) + 1;
        total += rv - 1;
        rolls[i] = rv;
        rerolled = true;
        rerollPairs.push({ original: 1, rerolled: rv });
      }
    }
    if (rerolled) formula += ' [Tavern Brawler]';

    if (rerollPairs.length > 0) {
      ctx.tavernBrawlerRerolls = rerollPairs;
      addEntry(ctx.campaignName, {
        type: 'ability_use',
        characterName: ps.name,
        abilityName: 'Tavern Brawler',
        description: `Tavern Brawler Damage Reroll: rerolled ${rerollPairs.length} damage die ${rerollPairs.length === 1 ? 'showing' : 'showing'} 1 on ${ctx.attack.name} — new values ${rerollPairs.map(p => p.rerolled).join(', ')}.`,
        targetName: ctx.targetName || null,
        timestamp: Date.now(),
      }).catch((e) => { console.error("[tavernBrawler:log-error]", e); });
    }

    return { data: { formula, total, rolls } };
  },
};
