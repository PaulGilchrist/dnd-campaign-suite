import { addEntry } from '../../ui/logService.js';

/**
 * Observer definitions for the action pipeline.
 * Each observer: { event, handler(ctx, result) }
 * The event is the step's subscription event (fired after handler runs).
 */
export function createObservers() {
  return [
    {
      event: 'damage:rolled',
      handler: async (ctx, result) => {
        const data = result?.data || {};
        if (data.formula) {
          addEntry(ctx.campaignName, {
            type: 'roll',
            characterName: ctx.playerStats?.name || 'unknown',
            rollType: 'damage',
            name: ctx.attack?.name || 'Attack',
            formula: data.formula,
            rolls: data.rolls || [],
            total: data.total || 0,
            modifier: data.modifier || 0,
            damageType: ctx.attack?.damageType || '',
            targetName: ctx.targetName || null,
          }).catch((e) => { console.error('[observer] Error logging damage roll:', e); });
        }
      },
    },

    {
      event: 'sneak:applied',
      handler: async (ctx, result) => {
        const data = result?.data || {};
        if (data.effectiveSneakDice > 0) {
          addEntry(ctx.campaignName, {
            type: 'ability_use',
            characterName: ctx.playerStats?.name || 'unknown',
            abilityName: 'Sneak Attack',
            description: `${ctx.playerStats?.name} applied Sneak Attack (${data.effectiveSneakDice}d6)`,
            targetName: ctx.targetName || null,
            timestamp: Date.now(),
          }).catch(() => {});
        }
      },
    },

    {
      event: 'damage:applied',
      handler: async (ctx, result) => {
        const data = result?.data || {};
        if (data._done) {
          addEntry(ctx.campaignName, {
            type: 'action_complete',
            characterName: ctx.playerStats?.name || 'unknown',
            actionName: ctx.attack?.name || 'Action',
            description: `${ctx.playerStats?.name} completed ${ctx.attack?.name || 'action'} with ${ctx.total || 0} total damage.`,
            total: ctx.total || 0,
            targetName: ctx.targetName || null,
            timestamp: Date.now(),
          }).catch(() => {});
        }
      },
    },
  ];
}
