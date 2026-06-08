import { rollExpression } from '../dice/diceRoller.js';
import { computeRangeEffect, computeEffectiveSpellRange, getDistanceFeet } from './rangeValidation.js';
import { isInnateSorceryActive, getActiveBuffs } from '../combat/buffService.js';
import { triggerPostCastRiderSaves } from './postCastRiderService.js';

export async function executeSpellCast(spell, metaCtx, { rollAttack, rollDamage, playerStats, getTargetInfo, attackerPos, targetPos, featEffects, campaignName, mapName }) {
    if (getActiveBuffs(playerStats.name, campaignName).some(b => b.blocksSpellcasting)) {
        console.warn(`[spellCast] ${playerStats.name} cannot cast spells (blocked by active buff)`);
        return;
    }
    const innateSorceryActive = isInnateSorceryActive(playerStats.name, campaignName);
  const slotDmg = spell.damage?.damage_at_slot_level;
  const charDmg = spell.damage?.damage_at_character_level;
  const formula =
     (slotDmg && slotDmg[spell.level]) ||
     (charDmg && charDmg[spell.level]) ||
     (slotDmg && Object.keys(slotDmg).length ? slotDmg[Object.keys(slotDmg)[0]] : null) ||
     (charDmg && Object.keys(charDmg).length ? charDmg[Object.keys(charDmg)[0]] : null) ||
    null;
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
      saveDc: playerStats.spellAbilities.saveDc + (innateSorceryActive ? 1 : 0),
      saveType: spell.dc.dc_type,
      dcSuccess: spell.dc.dc_success,
     };
    const result = rollExpression(formula);
    if (result) {
      rollDamage(spell.name, formula, result.total, result.rolls, result.modifier, context);
     }
     } else {
    const rollCtx = innateSorceryActive && !rollContext.forcedMode ? { ...rollContext, forcedMode: 'advantage' } : rollContext;
    rollAttack(spell.name, playerStats.spellAbilities.toHit, {
      autoDamageFormula: formula,
      autoDamageName: spell.name,
       ...rollCtx,
       });
     }

    triggerPostCastRiderSaves(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Post-cast rider save failed:', e);
    });
}
