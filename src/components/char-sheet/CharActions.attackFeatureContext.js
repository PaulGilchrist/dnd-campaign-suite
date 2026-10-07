// CLA-216: Halfling Lucky (target:'d20', condition:'roll_equals_1') — arm ctx.autoReroll
// on PC attack rolls so the shared d20RollComputation.js:214 consumer fires. Mirrors the
// CHECK lane (CharAbilities.jsx:113) and SAVE lane (CharAbilities.jsx:165) exactly.
// Guarded to roll_equals_1 so convert_miss_to_hit (Boon of Combat Prowess) never crosses
// wires — popup.autoRerollForAttack remains fed only by boonOfCombatProwess.
export function applyAttackFeatureContext(ctx, conditionEffects) {
    const ce = conditionEffects || {};
    if (ce.autoRerollForAttack && ce.autoRerollCondition === 'roll_equals_1') {
        ctx.autoReroll = true;
        ctx.autoRerollCondition = ce.autoRerollCondition;
        ctx.autoRerollBonus = ce.autoRerollBonus || null;
    }
    return ctx;
}
