import { rollExpression, rollExpressionDoubled, rollExpressionMaximized } from '../../dice/diceRoller.js';
import { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } from '../../rules/spells/postCastRiderService.js';
import { addEntry } from '../../ui/logService.js';
import { featureModules } from './features/index.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getChosenRuntimeValue } from '../../../services/automation/common/choiceStorage.js';

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
        const ps = ctx.playerStats;
        const isCantripFlag = ctx.isCantrip || false;

        // Empowered Evocation: add int mod to evocation cantrip damage
        const hasEmpoweredEvoc = getEmpoweredEvocationFeatures(ps).length > 0;
        const empEvocIntMod = hasEmpoweredEvoc ? getEmpoweredEvocationIntModifier(ps) : 0;
        const spellSchool = (ctx.autoDamageSchool || '').toLowerCase();
        const shouldApplyEmpoweredEvoc = hasEmpoweredEvoc && spellSchool === 'evocation' && empEvocIntMod > 0;

        if (shouldApplyEmpoweredEvoc) {
          formula = `${formula} + ${empEvocIntMod} [Empowered Evocation]`;
        }

        // Blessed Strikes / Potent Spellcasting: add spellcasting ability mod to cantrip damage
        if (isCantripFlag && ps.automation?.actions) {
          const potentFeature = ps.automation.actions.find(
            a => a.type === 'damage_bonus' && !a.upgrades && a.options?.some(o => o.toLowerCase().includes('spellcasting'))
          );
          if (potentFeature) {
            const optKey = `_${(potentFeature.name || 'PotentSpellcasting').replace(/\s+/g, '_')}_option`;
            const chosen = getRuntimeValue(ps.name, optKey, ctx.campaignName);
            if (potentFeature.options.length > 1 && !chosen) {
              // multi-option feature with no choice yet — skip
            } else if (chosen && chosen.toLowerCase().includes('spellcasting')) {
              const spellcastingAbility = potentFeature.abilityName || 'Wisdom';
              const wis = ps.abilities?.find(a => a.name === spellcastingAbility);
              const spellcastingMod = Math.max(0, wis?.bonus || 0);
              if (spellcastingMod > 0) {
                formula = `${formula} + ${spellcastingMod} [Blessed Strikes]`;
              }
            } else if (potentFeature.options.length === 1) {
              const spellcastingAbility = potentFeature.abilityName || 'Wisdom';
              const wis = ps.abilities?.find(a => a.name === spellcastingAbility);
              const spellcastingMod = Math.max(0, wis?.bonus || 0);
              if (spellcastingMod > 0) {
                formula = `${formula} + ${spellcastingMod} [Blessed Strikes]`;
              }
            }
          }
        }

        // Elemental Affinity: add CHA mod to one spell damage roll of chosen type
        const elementalAffinityType = getChosenRuntimeValue(ps, 'Elemental Affinity', 'chosenType', ctx.campaignName);
        if (elementalAffinityType && typeof elementalAffinityType === 'string') {
          const spellDamageType = (ctx.attack?.damageType || '').toLowerCase();
          const chosenTypeLower = elementalAffinityType.toLowerCase();
          if (spellDamageType === chosenTypeLower) {
            const charismaAbility = ps.abilities?.find(a => a.name === 'Charisma');
            const chaMod = Math.max(0, charismaAbility?.bonus || 0);
            if (chaMod > 0) {
              formula = `${formula} + ${chaMod} [Elemental Affinity]`;
            }
          }
        }

        // Radiant Soul: add CHA mod to spell damage when dealing Radiant or Fire damage
        const radiantSoulPassive = ps.automation?.passives?.find(p => p.type === 'radiant_soul');
        if (radiantSoulPassive && radiantSoulPassive.hasAutomation) {
          const spellDamageType = (ctx.attack?.damageType || '').toLowerCase();
          const damageTypes = (radiantSoulPassive.damageTypes || []).map(dt => dt.toLowerCase());
          const oncePerTurnKey = `_radiantSoul_${ps.name.replace(/\s+/g, '_')}_oncePerTurn`;
          const onceUsed = getRuntimeValue(ps.name, oncePerTurnKey, ctx.campaignName);
          console.error('[directSpellDamageSteps] Radiant Soul check: spellDamageType=', spellDamageType, 'damageTypes=', damageTypes, 'onceUsed=', onceUsed, 'match=', damageTypes.includes(spellDamageType));
          if (!onceUsed && damageTypes.includes(spellDamageType)) {
            const charismaAbility = ps.abilities?.find(a => a.name === 'Charisma');
            const chaMod = Math.max(0, charismaAbility?.bonus || 0);
            if (chaMod > 0) {
              formula = `${formula} + ${chaMod} [Radiant Soul]`;
              console.error('[directSpellDamageSteps] Radiant Soul APPLIED: formula=', formula, 'chaMod=', chaMod);
            }
          }
        }

        console.error('[directSpellDamageSteps] spellContext final formula=', formula, 'damageType=', ctx.attack?.damageType);
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
          }).catch(() => {});
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
        ctx.proceedWithDamage(ctx.attack, ctx.formula, ctx.total, ctx.rolls, ctx.modifier);
        return { data: { _done: true } };
      },
    },
  ];
}
