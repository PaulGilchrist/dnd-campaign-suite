import { rollExpression } from './diceRoller.js';

export function executeSpellCast(spell, metaCtx, { rollAttack, rollDamage, playerStats, getCombatTargetInfo }) {
  const slotDmg = spell.damage?.damage_at_slot_level;
  const charDmg = spell.damage?.damage_at_character_level;
  const dmgObj = slotDmg && Object.keys(slotDmg).length ? slotDmg : charDmg;
  const formula = dmgObj ? dmgObj[Object.keys(dmgObj)[0]] : null;
  const damageType = spell.damage?.damage_type || '';

  if (!formula) return;

  if (spell.dc) {
    const target = getCombatTargetInfo();
    const context = {
      targetName: target?.name,
      attackerName: playerStats.name,
      ...metaCtx,
      saveDc: playerStats.spellAbilities.saveDc,
      saveType: spell.dc.dc_type,
      dcSuccess: spell.dc.dc_success,
      damageType,
    };
    const result = rollExpression(formula);
    if (result) {
      rollDamage(spell.name, formula, result.total, result.rolls, result.modifier, context);
    }
  } else {
    rollAttack(spell.name, playerStats.spellAbilities.toHit, {
      autoDamageFormula: formula,
      autoDamageName: spell.name,
      damageType,
      ...metaCtx,
    });
  }
}
