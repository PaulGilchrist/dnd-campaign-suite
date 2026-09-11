import { rollExpression, rollExpressionDoubled, rollExpressionMaximized } from '../../dice/diceRoller.js';
import { hasTwoWeaponFighting } from '../../combat/automation/automationService.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getChosenRuntimeValue } from '../../automation/common/choiceStorage.js';

function getPositiveCharismaModifier(ps) {
  const charismaAbility = ps.abilities?.find(a => a.name === 'Charisma');
  return Math.max(0, charismaAbility?.bonus || 0);
}

function applyElementalAffinity(formula, ctx, ps) {
  const elementalAffinityType = getChosenRuntimeValue(ps, 'Elemental Affinity', 'chosenType', ctx.campaignName);
  if (!elementalAffinityType || typeof elementalAffinityType !== 'string') return formula;
  const spellDamageType = (ctx.attack?.damageType || '').toLowerCase();
  if (spellDamageType !== elementalAffinityType.toLowerCase()) return formula;
  const chaMod = getPositiveCharismaModifier(ps);
  if (chaMod <= 0) return formula;
  return `${formula} + ${chaMod} [Elemental Affinity]`;
}

// CLA-279: execution/index.js computeRadiantSoul is the single owner of the direct-path
// adder — attack.damage may already carry " + N [Radiant Soul]"; never re-append.
function applyRadiantSoulBonus(formula, ctx, ps) {
  const radiantSoulPassive = ps.automation?.passives?.find(p => p.type === 'radiant_soul');
  if (!radiantSoulPassive || !radiantSoulPassive.hasAutomation || formula.includes('[Radiant Soul]')) return formula;
  const spellDamageType = (ctx.attack?.damageType || '').toLowerCase();
  const damageTypes = (radiantSoulPassive.damageTypes || []).map(dt => dt.toLowerCase());
  const oncePerTurnKey = `_radiantSoul_${ps.name.replace(/\s+/g, '_')}_oncePerTurn`;
  const onceUsed = getRuntimeValue(ps.name, oncePerTurnKey, ctx.campaignName);
  if (onceUsed || !damageTypes.includes(spellDamageType)) return formula;
  const chaMod = getPositiveCharismaModifier(ps);
  if (chaMod <= 0) return formula;
  return `${formula} + ${chaMod} [Radiant Soul]`;
}

function markRadiantSoulUsed(ctx, ps) {
  if (!ps?.automation?.passives) return;
  const radiantSoulPassive = ps.automation.passives.find(p => p.type === 'radiant_soul');
  if (!radiantSoulPassive || !radiantSoulPassive.hasAutomation) return;
  const spellDamageType = (ctx.attack?.damageType || '').toLowerCase();
  const damageTypes = (radiantSoulPassive.damageTypes || []).map(dt => dt.toLowerCase());
  if (!damageTypes.includes(spellDamageType)) return;
  const oncePerTurnKey = `_radiantSoul_${ps.name.replace(/\s+/g, '_')}_oncePerTurn`;
  setRuntimeValue(ps.name, oncePerTurnKey, true, ctx.campaignName);
}

export function buildRollBaseDamageStep() {
  return {
    name: 'rollBaseDamage',
    subscribe: 'bi:checked',
    emit: 'damage:rolled',
    condition: (ctx) => !!ctx.attack?.damage || !!ctx.autoFormulaOverride,
    handler: async (ctx) => {
      const wasCrit = ctx.isCrit;
      if (wasCrit && ctx.setPopupHtml) ctx.setPopupHtml(null);

      let formula = ctx.autoFormulaOverride || ctx.attack.damage;
      const baseDamageType = (ctx.attack?.damageType || '').toLowerCase();
      if (baseDamageType) {
        formula = `${formula} [${baseDamageType}]`;
      }

      const empEvocMod = ctx.empoweredEvocationModifier || 0;
      if (empEvocMod > 0) {
        formula = `${formula} + ${empEvocMod} [Empowered Evocation]`;
      }

      const ps = ctx.playerStats;
      formula = applyElementalAffinity(formula, ctx, ps);
      formula = applyRadiantSoulBonus(formula, ctx, ps);

      const isOverchannel = ctx.overchannelActive;
      const result = isOverchannel
        ? rollExpressionMaximized(formula)
        : (wasCrit ? rollExpressionDoubled(formula) : rollExpression(formula));
      if (!result) return null;

      markRadiantSoulUsed(ctx, ps);

      return {
        data: { formula, total: result.total, rolls: result.rolls, modifier: result.modifier },
      };
    },
  };
}

export function buildBuildContextStep() {
  return {
    name: 'buildContext',
    subscribe: 'damage:rolled',
    emit: 'context:built',
    condition: (ctx) => !ctx.buildCtxResult && !ctx.autoDamageSource,
    handler: async (ctx) => {
      const buildFn = ctx.mapName ? ctx.buildCtx : ctx.buildCtxSync;
      if (!buildFn) return { data: {} };

      // WM-008: damage-phase ctx rebuild — do not consume one-shot attack te.
      const buildResult = await buildFn(ctx.attack, { consumeAttackTe: false });
      const sneakDice = buildResult?.sneakAttackDice || 0;
      const data = { buildCtxResult: buildResult, sneakDice };
      if (!ctx.targetName && buildResult?.targetName) data.targetName = buildResult.targetName;
      return { data };
    },
  };
}

export function buildSneakAttackStep() {
  return {
    name: 'sneakAttack',
    subscribe: 'context:built',
    emit: 'sneak:applied',
    condition: (ctx) => (ctx.sneakDice || 0) > 0,
    handler: async (ctx) => {
      const wasCrit = ctx.isCrit;
      const cost = Number(getRuntimeValue(ctx.playerStats.name, '_cunningStrikeCostUsed', ctx.campaignName) ?? 0);
      const effective = Math.max(0, ctx.sneakDice - cost);

      let formula = ctx.formula;
      let total = ctx.total;
      let rolls = [...(ctx.rolls || [])];

      if (effective > 0) {
        const sneakFormula = `${effective}d6`;
        const result = wasCrit ? rollExpressionDoubled(sneakFormula) : rollExpression(sneakFormula);
        if (result) {
          formula += ` + ${sneakFormula} [Sneak Attack]`;
          total += result.total;
          rolls = [...rolls, ...result.rolls];
          await setRuntimeValue(ctx.playerStats.name, '_SneakAttack_usedRound', getCurrentCombatRound(ctx.campaignName), ctx.campaignName);
        }
      }

      if (cost > 0) {
        await setRuntimeValue(ctx.playerStats.name, '_cunningStrikeCostUsed', 0, ctx.campaignName);
      }

      return { data: { formula, total, rolls, effectiveSneakDice: effective } };
    },
  };
}

export function buildTwoWeaponFightingStep() {
  return {
    name: 'twoWeaponFighting',
    subscribe: 'sneak:applied',
    emit: 'twf:applied',
    condition: (ctx) => ctx.isBonusActionAttack && !!ctx.playerStats,
    handler: async (ctx) => {
      if (!hasTwoWeaponFighting(ctx.playerStats)) return { data: {} };

      const props = ctx.attack?.properties || [];
      if (!props.includes('Light') || !ctx.attack?.abilityName) return { data: {} };

      const ability = ctx.playerStats.abilities?.find(a => a.name === ctx.attack.abilityName);
      const mod = ability?.bonus || 0;
      if (mod <= 0) return { data: {} };

      const re = new RegExp(`\\+${mod}\\[${ctx.attack.abilityName}\\]`);
      if (ctx.formula.match(re)) return { data: {} };

      const rolls = [...(ctx.rolls || []), mod];
      return {
        data: {
          formula: `${ctx.formula} + ${mod} [${ctx.attack.abilityName}]`,
          total: ctx.total + mod,
          rolls,
        },
      };
    },
  };
}

export function buildTargetEffectsStep() {
  return {
    name: 'targetEffects',
    subscribe: 'twf:applied',
    emit: 'effects:applied',
    condition: () => true,
    handler: async (ctx) => {
      const raw = getRuntimeValue('campaign', 'targetEffects');
      const stored = Array.isArray(raw) ? raw : [];
      const riders = stored.filter(te => te.effect === 'damage_bonus' && te.damageExpression);
      if (riders.length === 0) return { data: {} };

      let formula = ctx.formula;
      let total = ctx.total;
      let rolls = [...(ctx.rolls || [])];

      for (const te of riders) {
        const r = rollExpression(te.damageExpression);
        if (r) {
          const dt = te.label || (te.damageType || ctx.attack?.damageType || 'same_as_weapon').toLowerCase();
          formula += ` + ${te.damageExpression} [${dt}]`;
          total += r.total;
          rolls = [...rolls, ...r.rolls];
        }
      }

      const remaining = stored.filter(te => te.effect !== 'damage_bonus');
      setRuntimeValue('campaign', 'targetEffects', remaining, ctx.campaignName);

      return { data: { formula, total, rolls } };
    },
  };
}

export function buildSuperiorityDieBonusesStep() {
  return {
    name: 'superiorityDieBonuses',
    subscribe: 'effects:applied',
    emit: 'superiority:applied',
    condition: () => true,
    handler: async (ctx) => {
      let formula = ctx.formula;
      let total = ctx.total;
      let rolls = [...(ctx.rolls || [])];
      const defaultDmg = (ctx.attack?.damageType || 'same_as_weapon').toLowerCase();

      const consume = (key, label) => {
        const raw = getRuntimeValue(ctx.playerStats.name, key, ctx.campaignName);
        if (raw && Number(raw) > 0) {
          const val = Number(raw);
          const labelLower = typeof label === 'string' && !['Bardic Inspiration'].includes(label) ? label.toLowerCase() : label;
          formula += ` + ${val} [${labelLower}]`;
          total += val;
          rolls = [...rolls, val];
          setRuntimeValue(ctx.playerStats.name, key, null, ctx.campaignName);
          return true;
        }
        return false;
      };

      consume('feintingAttackDieValue', defaultDmg);
      consume('bardicInspirationOffenseValue', 'Bardic Inspiration');
      consume('pendingRiposteDieValue', defaultDmg);
      consume('attackRiderDieValue', defaultDmg);

      const isMelee = ctx.attack?.weaponType === 'melee' || ctx.attack?.weaponType === 'unarmed';
      if (isMelee) consume('lungingAttackDieValue', defaultDmg);

      const csRaw = getRuntimeValue(ctx.playerStats.name, 'commanderStrikeBonus', ctx.campaignName);
      if (csRaw && Number(csRaw) > 0) {
        const val = Number(csRaw);
        formula += ` + ${val} [${defaultDmg}]`;
        total += val;
        rolls = [...rolls, val];
        await setRuntimeValue(ctx.playerStats.name, 'commanderStrikeBonus', null, ctx.campaignName);
        await setRuntimeValue(ctx.playerStats.name, 'commanderStrikeActive', null, ctx.campaignName);
        await setRuntimeValue(ctx.playerStats.name, 'commanderStrikeSource', null, ctx.campaignName);
      }

      return { data: { formula, total, rolls, isMeleeOrUnarmed: isMelee } };
    },
  };
}
