import { rollExpression } from './diceRoller.js';
import { computeRangeEffect, computeEffectiveSpellRange, getDistanceFeet } from './rangeValidation.js';

export async function executeSpellCast(spell, metaCtx, { rollAttack, rollDamage, playerStats, getTargetInfo, attackerPos, targetPos, featEffects }) {
  const slotDmg = spell.damage?.damage_at_slot_level;
  const charDmg = spell.damage?.damage_at_character_level;
  const dmgObj = slotDmg && Object.keys(slotDmg).length ? slotDmg : charDmg;
  const formula = dmgObj ? dmgObj[Object.keys(dmgObj)[0]] : null;
  const damageType = spell.damage?.damage_type || '';

  if (!formula) return;

  const rollContext = { ...metaCtx, damageType };

  if (attackerPos && targetPos) {
    const effectiveRange = computeEffectiveSpellRange(spell.range, metaCtx);
    if (effectiveRange != null) {
      const distanceFt = getDistanceFeet(attackerPos, targetPos);
      const rangeResult = computeRangeEffect(effectiveRange, distanceFt, featEffects || {});
      if (rangeResult.mode === 'miss') {
        rollContext.isAutoMiss = true;
        rollContext.rangeReason = rangeResult.reason;
      }
    }
  }

  if (spell.dc) {
    const target = await getTargetInfo();
    const context = {
      targetName: target?.name,
      attackerName: playerStats.name,
      ...rollContext,
      saveDc: playerStats.spellAbilities.saveDc,
      saveType: spell.dc.dc_type,
      dcSuccess: spell.dc.dc_success,
    };
    const result = rollExpression(formula);
    if (result) {
      rollDamage(spell.name, formula, result.total, result.rolls, result.modifier, context);
    }
  } else {
    rollAttack(spell.name, playerStats.spellAbilities.toHit, {
      autoDamageFormula: formula,
      autoDamageName: spell.name,
      ...rollContext,
    });
  }
}
