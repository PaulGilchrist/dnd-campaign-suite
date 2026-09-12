import { rollExpression, rollExpressionDoubled, rollExpressionMaximized } from '../../dice/diceRoller.js';
import { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } from '../../rules/spells/postCastRiderService.js';
import { addEntry } from '../../ui/logService.js';
import { featureModules } from './features/index.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getChosenRuntimeValue } from '../../../services/automation/common/choiceStorage.js';

function applyEmpoweredEvocation(formula, ctx, ps) {
  const hasEmpoweredEvoc = getEmpoweredEvocationFeatures(ps).length > 0;
  const empEvocIntMod = hasEmpoweredEvoc ? getEmpoweredEvocationIntModifier(ps) : 0;
  const spellSchool = (ctx.autoDamageSchool || '').toLowerCase();
  if (hasEmpoweredEvoc && spellSchool === 'evocation' && empEvocIntMod > 0) {
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

        // Mark Radiant Soul as used for this turn
        if (ps?.automation?.passives) {
          const radiantSoulPassive = ps.automation.passives.find(p => p.type === 'radiant_soul');
          if (radiantSoulPassive && radiantSoulPassive.hasAutomation) {
            const spellDamageType = (ctx.attack?.damageType || '').toLowerCase();
            const damageTypes = (radiantSoulPassive.damageTypes || []).map(dt => dt.toLowerCase());
            if (damageTypes.includes(spellDamageType)) {
              const oncePerTurnKey = `_radiantSoul_${ps.name.replace(/\s+/g, '_')}_oncePerTurn`;
              setRuntimeValue(ps.name, oncePerTurnKey, true, ctx.campaignName);
            }
          }
        }

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
        const dicePerLevel = 2 + (ctx.overchannelUseCount - 1);
        const totalDice = dicePerLevel * ctx.overchannelSpellLevel;
        const r = rollExpression(`${totalDice}d12`);
        if (r) {
          addEntry(ctx.campaignName, {
            type: 'roll',
            characterName: ctx.playerStats?.name || 'unknown',
            rollType: 'overchannel-damage',
            name: 'Overchannel',
            formula: `${totalDice}d12`,
            rolls: r.rolls,
            total: r.total,
            modifier: r.modifier,
            damageType: 'Necrotic',
            targetName: ctx.playerStats?.name,
            finalDamage: r.total,
            note: 'Overchannel self-damage (ignores resistance/immunity)',
          }).catch((e) => { console.error("[directSpellDamageSteps:log-error]", e); });
        }
        return { data: {} };
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
