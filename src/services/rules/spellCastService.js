import { rollExpression } from '../dice/diceRoller.js';
import { computeRangeEffect, computeEffectiveSpellRange, getDistanceFeet, rangeToFeet } from './rangeValidation.js';
import { isInnateSorceryActive, getActiveBuffs } from '../combat/buffService.js';
import { triggerPostCastRiderSaves, triggerSpellThief, triggerBewitchingMagic } from './postCastRiderService.js';
import { triggerPostCastSelfHeals, triggerPostCastAllyHeals } from './postCastHealService.js';
import { triggerSmiteOfProtection } from './smiteOfProtectionService.js';
import { triggerInspiringSmite } from './inspiringSmiteService.js';
import { triggerPrimalCompanionSpellShare } from './primalCompanionSpellShareService.js';
import { triggerWildMagicSurge } from './wildMagicSurgeService.js';
import { setRuntimeValue, getRuntimeValue } from '../../hooks/useRuntimeState.js';
import { applyHealingToTarget } from './applyHealing.js';
import { getCombatContext } from './damageUtils.js';
import { postLogEntry } from '../shared/logPoster.js';

export async function executeSpellCast(spell, metaCtx, { rollAttack, rollDamage, playerStats, getTargetInfo, attackerPos, targetPos, featEffects, campaignName, mapName }) {
    if (getActiveBuffs(playerStats.name, campaignName).some(b => b.blocksSpellcasting)) {
        console.warn(`[spellCast] ${playerStats.name} cannot cast spells (blocked by active buff)`);
        return;
    }

    if (spell.casting_time === '1 action') {
        setRuntimeValue(playerStats.name, 'lastActionSpellCast', 1, campaignName);
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

  if (!formula) {
      if (spell.name.toLowerCase() === 'power word heal' && metaCtx?.multiTarget) {
          const target = await getTargetInfo();
          if (target?.name) {
              await applyPowerWordHealToTarget(target.name, playerStats, campaignName);
              await applyPowerWordHealToTarget(metaCtx.multiTarget, playerStats, campaignName);
          }
      }
      return;
  }

   const rollContext = { ...metaCtx, damageType };

   if (attackerPos && targetPos) {
     let effectiveRange = computeEffectiveSpellRange(spell.range, metaCtx);
     if (effectiveRange != null) {
       const cantripRangeBonus = (featEffects?.cantripRangeBonus) || 0;
       if (cantripRangeBonus > 0 && spell.level === 0) {
         const baseRange = rangeToFeet(spell.range);
         if (baseRange != null && baseRange >= 10) {
           effectiveRange += cantripRangeBonus;
         }
       }
       const distanceFt = getDistanceFeet(attackerPos, targetPos);
       const rangeResult = computeRangeEffect(effectiveRange, distanceFt, featEffects || {});
       if (rangeResult.mode === 'miss') {
         rollContext.isAutoMiss = true;
         rollContext.rangeReason = rangeResult.reason;
        }
     }
   }

   const magicalAmbush = (playerStats.automation?.passives || []).some(
     p => p.type === 'passive_rule' && p.effect === 'magical_ambush'
   );
   const casterConditions = getRuntimeValue(playerStats.name, 'activeConditions', campaignName) || [];
   const hasInvisible = magicalAmbush && casterConditions.some(c => String(c).toLowerCase() === 'invisible');

   if (spell.dc) {
     const target = await getTargetInfo();
     const context = {
       targetName: target?.name,
       attackerName: playerStats.name,
        ...rollContext,
       saveDc: playerStats.spellAbilities.saveDc + (innateSorceryActive ? 1 : 0),
       saveType: spell.dc.dc_type,
       dcSuccess: spell.dc.dc_success,
       metamagicHeighten: hasInvisible,
     };
    const result = rollExpression(formula);
    if (result) {
      rollDamage(spell.name, formula, result.total, result.rolls, result.modifier, context);
     }
      } else {
     const rollCtx = innateSorceryActive && !rollContext.forcedMode ? { ...rollContext, forcedMode: 'advantage' } : rollContext;
     const attackCtx = {
       autoDamageFormula: formula,
       autoDamageName: spell.name,
        ...rollCtx,
        };
     if (hasInvisible) {
       attackCtx.metamagicHeighten = true;
     }
     rollAttack(spell.name, playerStats.spellAbilities.toHit, attackCtx);
      }

    triggerPostCastRiderSaves(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Post-cast rider save failed:', e);
    });
    triggerPostCastSelfHeals(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Post-cast self-heal failed:', e);
    });
    triggerPostCastAllyHeals(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Post-cast ally-heal failed:', e);
    });
    triggerSmiteOfProtection(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Smite of Protection trigger failed:', e);
    });
    triggerInspiringSmite(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Inspiring Smite trigger failed:', e);
    });
    triggerPrimalCompanionSpellShare(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Primal companion spell share failed:', e);
    });
    triggerSpellThief(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Spell Thief failed:', e);
    });
    triggerWildMagicSurge(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Wild Magic Surge trigger failed:', e);
    });
    triggerBewitchingMagic(spell, metaCtx, playerStats, campaignName, mapName).catch(e => {
        console.error('[spellCast] Bewitching Magic trigger failed:', e);
    });
}

async function applyPowerWordHealToTarget(targetName, playerStats, campaignName) {
    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) return;

    const creature = combatSummary.creatures.find(c => c.name === targetName);
    if (!creature) return;

    const maxHp = creature.maxHp || playerStats.hitPoints || 0;
    const currentHp = creature.currentHp ?? getRuntimeValue(targetName, 'currentHitPoints', campaignName) ?? maxHp;
    const healAmount = maxHp - currentHp;

    if (healAmount > 0) {
        applyHealingToTarget(combatSummary, targetName, healAmount, campaignName);
    }

    const conditionsToRemove = ['charmed', 'frightened', 'paralyzed', 'poisoned', 'stunned'];
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const newConditions = conditions.filter(c => !conditionsToRemove.includes(String(c).toLowerCase()));
    if (newConditions.length !== conditions.length) {
        setRuntimeValue(targetName, 'activeConditions', newConditions, campaignName);
        for (const removed of conditionsToRemove) {
            if (!newConditions.some(c => String(c).toLowerCase() === removed)) {
                postLogEntry(campaignName, {
                    type: 'condition',
                    action: 'removed',
                    characterName: targetName,
                    condition: removed.charAt(0).toUpperCase() + removed.slice(1),
                    reason: 'Power Word Heal',
                    timestamp: Date.now(),
                });
            }
        }
    }

    postLogEntry(campaignName, {
        type: 'hp_change',
        targetName,
        delta: healAmount,
        currentHp: Math.min(maxHp, currentHp + healAmount),
        maxHp,
        isHealing: true,
        sourceName: playerStats.name,
        note: 'Power Word Heal',
    });
}
