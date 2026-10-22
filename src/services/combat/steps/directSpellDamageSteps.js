import { rollExpression, rollExpressionDoubled, rollExpressionMaximized } from '../../dice/diceRoller.js';
import { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } from '../../rules/spells/postCastRiderService.js';
import { addEntry } from '../../ui/logService.js';
import { featureModules } from './features/index.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getChosenRuntimeValue } from '../../../services/automation/common/choiceStorage.js';

// CLA-120: cast-resolution (execution/index.js computeEmpoweredEvocation) is the
// single owner of the INT fold — ctx.attack.damage may already carry the labeled
// term via a pre-baked autoDamageFormula; never re-append (CLA-279 shape).
function applyEmpoweredEvocation(formula, ctx, ps) {
  const hasEmpoweredEvoc = getEmpoweredEvocationFeatures(ps).length > 0;
  const empEvocIntMod = hasEmpoweredEvoc ? getEmpoweredEvocationIntModifier(ps) : 0;
  const spellSchool = (ctx.autoDamageSchool || '').toLowerCase();
  if (hasEmpoweredEvoc && spellSchool === 'evocation' && empEvocIntMod > 0 && !formula.includes('[Empowered Evocation]')) {
    return `${formula} + ${empEvocIntMod} [Empowered Evocation]`;
  }
  return formula;
}

function blessedStrikesModifier(ps, potentFeature) {
  const spellcastingAbility = potentFeature.abilityName || 'Wisdom';
  const wis = ps.abilities?.find(a => a.name === spellcastingAbility);
  return Math.max(0, wis?.bonus || 0);
}

function applyBlessedStrikes(formula, ctx, ps) {
  if (!ctx.isCantrip || !ps.automation?.actions) return formula;
  const potentFeature = ps.automation.actions.find(
    a => a.type === 'damage_bonus' && !a.upgrades && a.options?.some(o => o.toLowerCase().includes('spellcasting'))
  );
  if (!potentFeature) return formula;
  const optKey = `_${(potentFeature.name || 'PotentSpellcasting').replace(/\s+/g, '_')}_option`;
  const chosen = getRuntimeValue(ps.name, optKey, ctx.campaignName);
  const chosenSpellcasting = !!chosen && chosen.toLowerCase().includes('spellcasting');
  if (!chosenSpellcasting && potentFeature.options.length > 1) return formula;
  if (!chosenSpellcasting && potentFeature.options.length !== 1) return formula;
  const spellcastingMod = blessedStrikesModifier(ps, potentFeature);
  if (spellcastingMod > 0) {
    return `${formula} + ${spellcastingMod} [Blessed Strikes]`;
  }
  return formula;
}

function applyElementalAffinity(formula, ctx, ps) {
  const elementalAffinityType = getChosenRuntimeValue(ps, 'Elemental Affinity', 'chosenType', ctx.campaignName);
  if (!elementalAffinityType || typeof elementalAffinityType !== 'string') return formula;
  const spellDamageType = (ctx.attack?.damageType || '').toLowerCase();
  if (spellDamageType !== elementalAffinityType.toLowerCase()) return formula;
  const charismaAbility = ps.abilities?.find(a => a.name === 'Charisma');
  const chaMod = Math.max(0, charismaAbility?.bonus || 0);
  if (chaMod > 0) {
    return `${formula} + ${chaMod} [Elemental Affinity]`;
  }
  return formula;
}

function applyRadiantSoul(formula, ctx, ps) {
  // CLA-279: execution/index.js computeRadiantSoul is the single owner of the direct-path
  // adder — ctx.attack.damage may already carry " + N [Radiant Soul]"; never re-append.
  const radiantSoulPassive = ps.automation?.passives?.find(p => p.type === 'radiant_soul');
  if (!radiantSoulPassive || !radiantSoulPassive.hasAutomation || formula.includes('[Radiant Soul]')) return formula;
  const spellDamageType = (ctx.attack?.damageType || '').toLowerCase();
  const damageTypes = (radiantSoulPassive.damageTypes || []).map(dt => dt.toLowerCase());
  const oncePerTurnKey = `_radiantSoul_${ps.name.replace(/\s+/g, '_')}_oncePerTurn`;
  const onceUsed = getRuntimeValue(ps.name, oncePerTurnKey, ctx.campaignName);
  if (onceUsed || !damageTypes.includes(spellDamageType)) return formula;
  const charismaAbility = ps.abilities?.find(a => a.name === 'Charisma');
  const chaMod = Math.max(0, charismaAbility?.bonus || 0);
  if (chaMod > 0) {
    return `${formula} + ${chaMod} [Radiant Soul]`;
  }
  return formula;
}

// #1028 latch honesty (mirrors fix#65 attackRollDamageCalc.js markRadiantSoulUsed :45-55
// applied-flag stamp-if-applied shape): the once-per-turn latch is consumed only when the
// adder ACTUALLY lands on this roll. Disk law (public/data/2024/classes.json, Warlock →
// Celestial Patron, level 6): "add Charisma modifier to that spell's damage" — at Cha mod 0
// nothing is added, so nothing is consumed; the latch stays armed and the next qualifying
// Radiant/Fire spell rides. Both adder sites feeding the rolled ctx.formula gate on
// chaMod > 0 (applyRadiantSoul above; execution/damageCalculation.js computeRadiantSoul :94
// for the pre-baked CLA-279 path), so a '[Radiant Soul]' byte in the rolled formula is the
// applied-non-zero proof.
function markRadiantSoulUsed(ctx, ps, formula) {
  if (!ps?.automation?.passives) return;
  const radiantSoulPassive = ps.automation.passives.find(p => p.type === 'radiant_soul');
  if (!radiantSoulPassive || !radiantSoulPassive.hasAutomation) return;
  const spellDamageType = (ctx.attack?.damageType || '').toLowerCase();
  const damageTypes = (radiantSoulPassive.damageTypes || []).map(dt => dt.toLowerCase());
  if (!damageTypes.includes(spellDamageType)) return;
  if (!formula.includes('[Radiant Soul]')) return; // stamp only if applied (#1028)
  const oncePerTurnKey = `_radiantSoul_${ps.name.replace(/\s+/g, '_')}_oncePerTurn`;
  setRuntimeValue(ps.name, oncePerTurnKey, true, ctx.campaignName);
}

/**
 * Build the damage pipeline steps for a spell-type action.
 * Each step: { name, subscribe, emit, condition(ctx), handler(ctx) → result|null }
 */
export function buildDirectSpellDamageSteps() {
  return [

    // =========================================================
    // Step: spellHousekeeping — clear per-round flags for spells
    // =========================================================
    {
      name: 'spellHousekeeping',
      subscribe: 'spell:do',
      emit: 'spell:context',
      condition: () => true,
      handler: async () => {
        return { data: {} };
      },
    },

    // =========================================================
    // Step: spellContext — Build spell context (empowered evocation, blessed strikes, etc.)
    // =========================================================
    {
      name: 'spellContext',
      subscribe: 'spell:context',
      emit: 'spell:formulas',
      condition: (ctx) => !!ctx.playerStats,
      handler: async (ctx) => {
        let formula = ctx.attack?.damage || ctx.autoFormulaOverride || '0';
        formula = applyEmpoweredEvocation(formula, ctx, ctx.playerStats);
        formula = applyBlessedStrikes(formula, ctx, ctx.playerStats);
        formula = applyElementalAffinity(formula, ctx, ctx.playerStats);
        formula = applyRadiantSoul(formula, ctx, ctx.playerStats);
        return { data: { formula } };
      },
    },

    // =========================================================
    // Step: spellRollDamage — Roll spell damage dice
    // =========================================================
    {
      name: 'spellRollDamage',
      subscribe: 'spell:formulas',
      emit: 'spell:rolled',
      condition: (ctx) => !!ctx.attack?.damage || !!ctx.autoFormulaOverride,
      handler: async (ctx) => {
        const wasCrit = ctx.isCrit;
        const isOverchannel = ctx.overchannelActive;
        const ps = ctx.playerStats;

        let result;
        if (isOverchannel) {
          result = rollExpressionMaximized(ctx.formula);
        } else {
          result = wasCrit ? rollExpressionDoubled(ctx.formula) : rollExpression(ctx.formula);
        }
        if (!result) return null;

        // Mark Radiant Soul as used for this turn (#1028 latch honesty — see helper).
        markRadiantSoulUsed(ctx, ps, ctx.formula);

        return {
          data: { formula: ctx.formula, total: result.total, rolls: result.rolls, modifier: result.modifier },
        };
      },
    },

    // =========================================================
    // Step: spellFeatureRiders — dispatches to individual feature modules
    // =========================================================
    {
      name: 'spellFeatureRiders',
      subscribe: 'spell:rolled',
      emit: 'spell:riders:applied',
      condition: () => true,
      handler: async (ctx) => {
        let data = { formula: ctx.formula, total: ctx.total, rolls: [...(ctx.rolls || [])] };
        for (const feat of featureModules) {
          if (feat.condition(ctx)) {
            const result = await feat.handler(ctx, data);
            if (!result) continue;
            if (result.modal) return result;
            if (result.data) data = result.data;
            if (result.sideEffects) await result.sideEffects();
          }
        }
        return { data };
      },
    },

    // =========================================================
    // Step: spellOverchannel — Wizard Overchannel self-damage for spells
    // =========================================================
    {
      name: 'spellOverchannel',
      subscribe: 'spell:riders:applied',
      emit: 'spell:ready',
      condition: (ctx) => ctx.overchannelActive && ctx.overchannelUseCount > 1,
      handler: async (ctx) => {
        const dicePerLevel = Math.max(2, ctx.overchannelUseCount);
        const totalDice = dicePerLevel * ctx.overchannelSpellLevel;
        const costFormula = `${totalDice}d12`;
        const r = rollExpression(costFormula);
        if (r) {
          addEntry(ctx.campaignName, {
            type: 'roll',
            characterName: ctx.playerStats?.name || 'unknown',
            rollType: 'overchannel-damage',
            name: 'Overchannel',
            formula: costFormula,
            rolls: r.rolls,
            total: r.total,
            modifier: r.modifier,
            damageType: 'Necrotic',
            targetName: ctx.playerStats?.name,
            finalDamage: r.total,
            note: 'Overchannel self-damage (ignores resistance/immunity)',
          }).catch((e) => { console.error("[directSpellDamageSteps:log-error]", e); });
          return { data: {} };
        }
        // #1044 no-free-ride: cost roll null while spellRollDamage :149-153 already
        // maximized ctx.total = the RAW cost unpaired with the RAW bonus
        // (public/data/2024/classes.json Wizard lv14: "take 2d12 Necrotic damage per
        // level of spell slot immediately after casting"). Nothing is applied or logged
        // before spellProceedToDamage consumes the merged ctx bytes, so this is the
        // clean seam to strip the bonus: re-roll the BASE formula with the same
        // crit-aware dispatcher spellRollDamage would have used without overchannel
        // (overchannel beats crit there — refused overchannel must not double-apply,
        // and a genuine crit must not lose its dice). Loud-reject console.error +
        // playbook §5 refusal log (a skip MUST log). No latch burns here — overchannel
        // is neither sorcery-point nor once-per-turn; the escalating overchannelUseCount
        // is owned upstream by computeOverchannel and is never re-charged from this
        // lane. Base re-roll null (maximized roll succeeded upstream ⇒ only a mutated
        // ctx.formula can) — nothing honest to hand downstream → fix#69 null = abort.
        console.error(`[directSpellDamageSteps] Overchannel cost roll failed (${costFormula}) — refusing uncosted maximized bonus`);
        const base = ctx.isCrit ? rollExpressionDoubled(ctx.formula) : rollExpression(ctx.formula);
        addEntry(ctx.campaignName, {
          type: 'automation',
          characterName: ctx.playerStats?.name || 'unknown',
          automationType: 'overchannel_refused',
          abilityName: 'Overchannel',
          note: 'overchannel_refused',
          reason: `cost roll failed (${costFormula})`,
          description: base
            ? `Overchannel refused (cost roll failed: ${costFormula}) — maximized bonus stripped, spell cast at base dice for ${base.total}. No necrotic self-damage rolled.`
            : `Overchannel refused (cost roll failed: ${costFormula}) and base damage (${ctx.formula}) could not be rolled — spell aborted, no damage applied.`,
          timestamp: Date.now(),
        }).catch((e) => { console.error("[directSpellDamageSteps:log-error]", e); });
        if (!base) return null;
        return {
          data: {
            formula: ctx.formula,
            total: base.total,
            rolls: base.rolls,
            modifier: base.modifier,
            overchannelActive: false,
            overchannelRefused: true,
          },
        };
      },
    },

    // =========================================================
    // Step: spellProceedToDamage — Call rollDamage with spell results
    // =========================================================
    {
      name: 'spellProceedToDamage',
      subscribe: 'spell:ready',
      emit: 'spell:applied',
      condition: (ctx) => ctx.formula != null,
      handler: async (ctx) => {
        ctx.proceedWithDamage({ attack: ctx.attack, formula: ctx.formula, total: ctx.total, rolls: ctx.rolls, modifier: ctx.modifier });
        return { data: { _done: true } };
      },
    },
  ];
}
