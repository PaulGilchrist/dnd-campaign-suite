import { rollExpression } from '../../dice/diceRoller.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { evaluateAutoExpression } from '../../combat/automation/automationService.js';
import { getActiveBuffs } from '../../automation/common/buffToggle.js';
import { resolveDiceExpression } from '../automation/automationExpressions.js';
import { addEntry } from '../../ui/logService.js';
import { selectBrutalStrikeRiders } from '../brutalStrikeSelection.js';

function applyMeleeWeaponHitBonuses(ctx, acc) {
  const melee = (ctx.playerStats.automation.actions || []).filter(x => x.type === 'damage_bonus' && x.trigger === 'melee_weapon_hit');
  if (melee.length === 0 || ctx.isMeleeOrUnarmed !== true) return acc;
  for (const a of melee) {
    const r = rollExpression(a.damageExpression);
    if (r) { acc.formula += ` + ${a.damageExpression} [${a.damageType.toLowerCase()}]`; acc.total += r.total; acc.rolls = [...acc.rolls, ...r.rolls]; }
  }
  return acc;
}

function applyMonkWeaponHitBonuses(ctx, acc) {
  const monks = (ctx.playerStats.automation.actions || []).filter(x => x.type === 'damage_bonus' && x.trigger === 'monk_weapon_or_unarmed_hit');
  for (const a of monks) {
    const r = rollExpression(a.damageExpression);
    if (!r) continue;
    const dt = (getRuntimeValue(ctx.playerStats.name, '_Elemental_Attunement_option', ctx.campaignName) || 'fire').toLowerCase();
    acc.formula += ` + ${a.damageExpression} [${dt}]`; acc.total += r.total; acc.rolls = [...acc.rolls, ...r.rolls];
  }
  return acc;
}

function applyHeavyWeaponHitBonuses(ctx, acc) {
  const heavy = (ctx.playerStats.automation.actions || []).filter(x => x.type === 'damage_bonus' && x.trigger === 'melee_heavy_weapon_hit');
  if (heavy.length === 0 || !(ctx.attack?.properties || []).includes('Heavy')) return acc;
  for (const a of heavy) {
    const r = rollExpression(a.damageExpression);
    const evalResult = evaluateAutoExpression(a.damageExpression, ctx.playerStats);
    const bonusValue = r ? r.total : evalResult;
    if (!bonusValue) continue;
    const dt = (a.damageType || ctx.attack?.damageType || 'Slashing').toLowerCase();
    const label = dt === 'same_as_weapon' ? (a.name || 'slashing') : dt;
    const displayExpr = r ? a.damageExpression : String(bonusValue);
    acc.formula += ` + ${displayExpr} [${label}]`;
    acc.total += bonusValue;
    if (r) acc.rolls = [...acc.rolls, ...r.rolls];
  }
  return acc;
}

function abilityBonus(playerStats, abilityName) {
  return playerStats.abilities?.find(a => a.name === abilityName)?.bonus ?? 0;
}

function isStrengthAttack(ctx) {
  const attackAbilityName = ctx.attack?.abilityName;
  if (attackAbilityName) return attackAbilityName.toLowerCase() === 'strength';
  return abilityBonus(ctx.playerStats, 'Strength') >= abilityBonus(ctx.playerStats, 'Dexterity');
}

function frenzyTriggerActive(ctx) {
  const buffs = getRuntimeValue(ctx.playerStats.name, 'activeBuffs', ctx.campaignName) || [];
  if (!buffs.some(b => b.effect === 'advantage_attacks_advantage_against')) return false;
  if (!buffs.some(b => b.damageBonusExpression)) return false;
  return isStrengthAttack(ctx);
}

function frenzyDamageLabel(ctx, a) {
  if (a.damageType === 'same_as_weapon') return (ctx.attack?.damageType || 'Slashing').toLowerCase();
  return a.damageType.toLowerCase();
}

function applyFrenzyBonuses(ctx, acc) {
  const frenzy = (ctx.playerStats.automation.actions || []).filter(x => x.type === 'damage_bonus' && x.trigger === 'reckless_attack_hit_while_raging');
  if (frenzy.length === 0) return acc;
  const used = getRuntimeValue(ctx.playerStats.name, '_frenzyUsedRound', ctx.campaignName);
  const round = getCurrentCombatRound(ctx.campaignName);
  if (used === round || !ctx.hit) return acc;
  if (!frenzyTriggerActive(ctx)) return acc;
  for (const a of frenzy) {
    const resolvedExpr = resolveDiceExpression(a.damageExpression, ctx.playerStats);
    const r = rollExpression(resolvedExpr);
    if (!r) continue;
    acc.formula += ` + ${resolvedExpr} [${frenzyDamageLabel(ctx, a)}]`;
    acc.total += r.total;
    acc.rolls = [...acc.rolls, ...r.rolls];
  }
  setRuntimeValue(ctx.playerStats.name, '_frenzyUsedRound', round, ctx.campaignName);
  return acc;
}

function applyDivineFuryBonuses(ctx, acc) {
  const df = (ctx.playerStats.automation.actions || []).filter(x => x.type === 'damage_bonus' && x.trigger === 'first_hit_while_raging');
  if (df.length === 0) return acc;
  const used = getRuntimeValue(ctx.playerStats.name, '_divineFuryUsedRound', ctx.campaignName);
  const round = getCurrentCombatRound(ctx.campaignName);
  if (used === round) return acc;
  const buffs = getRuntimeValue(ctx.playerStats.name, 'activeBuffs', ctx.campaignName) || [];
  const isRaging = buffs.some(b => b.damageBonusExpression);
  if (!isRaging) return acc;
  const a = df[0];
  let expr = a.damageExpression || '';
  expr = expr.replace(/barbarian_level\s*\/\s*2/gi, String(Math.floor(ctx.playerStats.level / 2)))
    .replace(/barbarian_level/gi, String(ctx.playerStats.level));
  const r = rollExpression(expr);
  if (r) {
    const dt = a.damageType || '';
    if (dt.includes(' or ')) {
      ctx.setDivineFuryChoice?.(dt);
      return { modalResult: {
        data: { _divineFuryPending: true, bonusExpr: expr, bonusTotal: r.total, bonusRolls: r.rolls },
        modal: { type: 'divineFury', props: { damageType: dt } },
      } };
    }
    acc.formula += ` + ${expr} [${dt}]`; acc.total += r.total; acc.rolls = [...acc.rolls, ...r.rolls];
  }
  setRuntimeValue(ctx.playerStats.name, '_divineFuryUsedRound', round, ctx.campaignName);
  return acc;
}

function applyBrutalStrikeTargetEffects(ctx, rider) {
  const effectChoices = getRuntimeValue(ctx.playerStats.name, '_brutalStrikeEffects', ctx.campaignName) || [];
  const targetName = ctx.targetName;
  if (effectChoices.length === 0 || !targetName) return;

  let storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
  const riderOptions = rider.options || [];

  for (const choiceName of effectChoices) {
    const option = riderOptions.find(o => o.name === choiceName);
    if (!option) continue;

    if (option.effect === 'disadvantage_on_next_save' || option.effect === 'next_attack_bonus') {
      const newEffect = {
        target: targetName,
        source: ctx.playerStats.name,
        option: option.name,
        effect: option.effect,
        value: option.effect === 'next_attack_bonus' ? (option.value || 5) : (option.value || null),
        noOpportunityAttacks: option.noOpportunityAttacks || false,
        duration: 'until_start_of_next_turn',
      };
      storedEffects = [...storedEffects, newEffect];
    }
  }
  setRuntimeValue('campaign', 'targetEffects', storedEffects, ctx.campaignName);
}

function applyBrutalStrikeBonuses(ctx, acc) {
  const brutalStrikeActive = getRuntimeValue(ctx.playerStats.name, '_brutalStrikeActive', ctx.campaignName);
  if (!brutalStrikeActive) return acc;
  const allAutomation = [...(ctx.playerStats.automation.actions || []), ...(ctx.playerStats.automation.passives || [])];
  const rider = selectBrutalStrikeRiders(allAutomation)[0];
  if (!rider) return acc;

  const r = rollExpression(rider.damageExpression);
  if (r) {
    acc.formula += ` + ${rider.damageExpression} [${(rider.damageType || 'same_as_weapon').toLowerCase()}]`;
    acc.total += r.total;
    acc.rolls = [...acc.rolls, ...r.rolls];
  }

  applyBrutalStrikeTargetEffects(ctx, rider);

  const targetName = ctx.targetName;
  addEntry(ctx.campaignName, { type: 'ability_use', characterName: ctx.playerStats.name, abilityName: rider.name, description: `${ctx.playerStats.name} used ${rider.name} on ${targetName}`, targetName }).catch((e) => { console.error("[attackRollBonuses:log-error]", e); });

  setRuntimeValue(ctx.playerStats.name, '_brutalStrikeActive', null, ctx.campaignName);
  setRuntimeValue(ctx.playerStats.name, '_brutalStrikeEffects', null, ctx.campaignName);
  return acc;
}

export function buildAutomationBonusesStep() {
  return {
    name: 'automationBonuses',
    subscribe: 'superiority:applied',
    emit: 'automation:applied',
    condition: (ctx) => (!!ctx.playerStats.automation?.actions || !!ctx.playerStats.automation?.passives),
    handler: async (ctx) => {
      let acc = { formula: ctx.formula, total: ctx.total, rolls: [...(ctx.rolls || [])] };
      acc = applyMeleeWeaponHitBonuses(ctx, acc);
      acc = applyMonkWeaponHitBonuses(ctx, acc);
      acc = applyHeavyWeaponHitBonuses(ctx, acc);
      acc = applyFrenzyBonuses(ctx, acc);
      const fury = applyDivineFuryBonuses(ctx, acc);
      if (fury.modalResult) return fury.modalResult;
      acc = fury;
      acc = applyBrutalStrikeBonuses(ctx, acc);
      return { data: acc };
    },
  };
}

const underscored = (name) => name.replace(/\s+/g, '_');

function weaponHitChoiceSkips(ctx, bonus) {
  const optKey = `_${underscored(bonus.upgrades || bonus.name)}_option`;
  const chosen = getRuntimeValue(ctx.playerStats.name, optKey, ctx.campaignName);
  if (!(bonus.options?.length > 0)) return false;
  return !chosen || !chosen.toLowerCase().includes('strike');
}

function weaponHitBonusSpent(ctx, bonus, usedKey, round) {
  if (bonus.oncePerTurn && getRuntimeValue(ctx.playerStats.name, usedKey, ctx.campaignName) === round) return true;
  if (bonus.uses_expression && bonus.recharge) {
    const usesKey = `_${underscored(bonus.name)}_uses`;
    const cur = Number(getRuntimeValue(ctx.playerStats.name, usesKey, ctx.campaignName) ?? bonus.usesMax);
    if (cur <= 0) return true;
  }
  return false;
}

function consumeWeaponHitUses(ctx, bonus, usedKey, round) {
  if (bonus.oncePerTurn) setRuntimeValue(ctx.playerStats.name, usedKey, round, ctx.campaignName);
  if (bonus.uses_expression && bonus.recharge) {
    const usesKey = `_${underscored(bonus.name)}_uses`;
    const cur = Number(getRuntimeValue(ctx.playerStats.name, usesKey, ctx.campaignName) ?? bonus.usesMax);
    if (cur > 0) setRuntimeValue(ctx.playerStats.name, usesKey, cur - 1, ctx.campaignName);
  }
}

function weaponHitModalResult(bonus, r) {
  return {
    data: { _weaponHitPending: true, bonusExpr: bonus.damageExpression, bonusTotal: r.total, bonusRolls: r.rolls, _weaponHitOnceKey: `_${underscored(bonus.name)}_usedRound` },
    modal: { type: 'damageTypeChoice', props: { title: `${bonus.name} — Damage Type`, types: bonus.damageType.split(/\s+or\s+/).flatMap(t => t.split(/\s+/)).filter(Boolean) } },
  };
}

// SP-112: 'weapon_attack_hit' / 'weapon_or_beast_form_attack_hit' riders
// (Blessed Strikes/Divine Strike, Dreadful Strikes, Lunar Form) are WEAPON-ONLY.
// Mirror the combatSuperiorityQueries.js gate (`trigger weapon_attack_hit &&
// !isWeaponAttack → skip`) and the FT-071 `!attack.school && weaponType !== 'spell'`
// discriminator: a SPELL attack (Spiritual Weapon force, Luminous Arrow — any
// autoDamage carrying a spell school or spell attackType) must never collect a
// weapon damage_bonus, stamp _Divine_Strike_usedRound, or open the damage-type modal.
function isSpellAttackContext(ctx) {
  return !!ctx.autoDamageSchool
    || ctx.attack?.weaponType === 'spell'
    || ctx.attack?.attackType === 'spell'
    || !!ctx.attack?.school
    || ctx.attack?.isWeaponAttack === false;
}

function collectWeaponHitBonuses(ctx) {
  const all = [...(ctx.playerStats.automation.actions || []), ...(ctx.playerStats.automation.passives || [])];
  const upgraded = new Set(all.filter(b => b.upgrades).map(b => b.upgrades));

  return ctx.playerStats.automation.actions.filter(
    a => a.type === 'damage_bonus' && (a.trigger === 'weapon_attack_hit' || a.trigger === 'weapon_or_beast_form_attack_hit')
  ).filter(b => !upgraded.has(b.name));
}

function applyWeaponHitBonus(ctx, bonus, round, acc) {
  if (weaponHitChoiceSkips(ctx, bonus)) return null;

  const usedKey = `_${underscored(bonus.name)}_usedRound`;
  if (weaponHitBonusSpent(ctx, bonus, usedKey, round)) return null;

  const r = rollExpression(bonus.damageExpression);
  if (!r) return null;

  const dt = bonus.damageType || '';
  if (dt.includes(' or ')) {
    return weaponHitModalResult(bonus, r);
  }
  acc.formula += ` + ${bonus.damageExpression} [${dt.toLowerCase()}]`;
  acc.total += r.total;
  acc.rolls = [...acc.rolls, ...r.rolls];

  consumeWeaponHitUses(ctx, bonus, usedKey, round);
  return null;
}

export function buildWeaponHitBonusesStep() {
  return {
    name: 'weaponHitBonuses',
    subscribe: 'automation:applied',
    emit: 'weapon_hit:applied',
    condition: (ctx) => !!ctx.playerStats.automation?.actions,
    handler: async (ctx) => {
      const acc = { formula: ctx.formula, total: ctx.total, rolls: [...(ctx.rolls || [])] };
      if (isSpellAttackContext(ctx)) return { data: acc };

      const bonuses = collectWeaponHitBonuses(ctx);
      const round = getCurrentCombatRound(ctx.campaignName);

      for (const bonus of bonuses) {
        const modalResult = applyWeaponHitBonus(ctx, bonus, round, acc);
        if (modalResult) return modalResult;
      }

      return { data: acc };
    },
  };
}

function resolveNatural20Expression(a, playerStats) {
  const expr = a.extraDamageExpression || '';
  if (expr !== 'increased_ability_score') return expr;
  const abilityName = a.abilityIncreased || null;
  if (abilityName) {
    const abil = playerStats.abilities?.find(x => x.name === abilityName);
    return abil?.bonus || 0;
  }
  const strBonus = playerStats.abilities?.find(x => x.name === 'Strength')?.bonus || 0;
  const dexBonus = playerStats.abilities?.find(x => x.name === 'Dexterity')?.bonus || 0;
  return Math.max(strBonus, dexBonus);
}

export function buildNatural20BonusesStep() {
  const OVERWHELMING_STRIKE_TEST_ROLL = 20;

  return {
    name: 'natural20Bonuses',
    subscribe: 'weapon_hit:applied',
    emit: 'n20:applied',
    condition: (ctx) => {
      const d20Val = ctx.d20Roll;
      const matches = ctx.isNatural20 || (d20Val >= OVERWHELMING_STRIKE_TEST_ROLL);
      const hasActions = !!ctx.playerStats.automation?.actions;
      return matches && hasActions;
    },
    handler: async (ctx) => {
      let formula = ctx.formula;
      let total = ctx.total;
      let rolls = [...(ctx.rolls || [])];

      const matchingActions = ctx.playerStats.automation.actions.filter(x => x.type === 'damage_bonus' && x.trigger === 'natural_20_attack_roll');
      for (const a of matchingActions) {
        const expr = resolveNatural20Expression(a, ctx.playerStats);
        if (expr || expr === 0) {
          const r = rollExpression(String(expr));
          if (r) {
            formula += ` + ${expr} [${a.name}]`;
            total += r.total;
            rolls = [...rolls, ...r.rolls];
          } else if (typeof expr === 'number') {
            formula += ` + ${expr} [${a.name}]`;
            total += expr;
          }
        }
      }

      return { data: { formula, total, rolls } };
    },
  };
}

export function buildCelestialRevelationStep() {
  return {
    name: 'celestialRevelation',
    subscribe: 'n20:applied',
    emit: 'celestial:applied',
    condition: (ctx) => !!ctx.playerStats.automation?.passives,
    handler: async (ctx) => {
      if (!ctx.targetName) return { data: {} };
      const riders = ctx.playerStats.automation.passives.filter(
        a => a.type === 'attack_rider' && a.damageExpression && a.trigger === 'hit'
      );
      if (riders.length === 0) return { data: {} };

      const activeBuffs = getActiveBuffs(ctx.playerStats.name, ctx.campaignName);
      const names = ['Heavenly Wings', 'Inner Radiance', 'Necrotic Shroud'];
      const active = activeBuffs.find(b => names.includes(b.name));
      if (!active) return { data: {} };

      const rider = riders.find(r => r.name === active.name);
      if (!rider) return { data: {} };

      const usedKey = `_${rider.name.replace(/\s+/g, '_')}_usedRound`;
      const round = getCurrentCombatRound(ctx.campaignName);
      if (rider.oncePerTurn && getRuntimeValue(ctx.playerStats.name, usedKey, ctx.campaignName) === round) return { data: {} };

      const r = rollExpression(rider.damageExpression);
      if (r) {
        const dt = (rider.damageType || '').toLowerCase();
        const formula = `${ctx.formula} + ${rider.damageExpression} [${dt}]`;
        const total = ctx.total + r.total;
        const rolls = [...(ctx.rolls || []), ...r.rolls];
        if (rider.oncePerTurn) setRuntimeValue(ctx.playerStats.name, usedKey, round, ctx.campaignName);
        return { data: { formula, total, rolls } };
      }
      return { data: {} };
    },
  };
}
