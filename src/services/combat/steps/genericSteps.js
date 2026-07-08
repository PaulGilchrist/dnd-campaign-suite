import { rollExpression } from '../../dice/diceRoller.js';

/**
 * Build generic pipeline steps for automation actions that don't fit weapon or spell categories.
 * Each step: { name, subscribe, emit, condition(ctx), handler(ctx) → result|null }
 */
export function buildGenericSteps() {
  return [

    // =========================================================
    // Step: genericHousekeeping — Initialize generic action context
    // =========================================================
    {
      name: 'genericHousekeeping',
      subscribe: 'generic:do',
      emit: 'generic:ready',
      condition: () => true,
      handler: async () => {
        return { data: {} };
      },
    },

    // =========================================================
    // Step: genericRollDamage — Roll generic automation damage
    // =========================================================
    {
      name: 'genericRollDamage',
      subscribe: 'generic:ready',
      emit: 'generic:applied',
      condition: (ctx) => !!ctx.attack?.damage || !!ctx.autoFormulaOverride,
      handler: async (ctx) => {
        const formula = ctx.autoFormulaOverride || ctx.attack.damage || '0';
        const result = rollExpression(formula);
        if (!result) return null;

        return {
          data: { formula, total: result.total, rolls: result.rolls, modifier: result.modifier },
        };
      },
    },

    // =========================================================
    // Step: genericProceed — Call rollDamage with generic results
    // =========================================================
    {
      name: 'genericProceed',
      subscribe: 'generic:applied',
      emit: 'pipeline:complete',
      condition: (ctx) => ctx.formula != null,
      handler: async (ctx) => {
        ctx.proceedWithDamage(ctx.attack, ctx.formula, ctx.total, ctx.rolls, ctx.modifier);
        return { data: { _done: true } };
      },
    },
  ];
}
