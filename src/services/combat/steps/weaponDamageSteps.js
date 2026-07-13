import { rollExpression, rollExpressionDoubled, rollExpressionMaximized } from '../../dice/diceRoller.js';
import { getCombatContext, getTargetFromAttacker } from '../../rules/combat/damageUtils.js';
import { getCurrentCombatRound, loadCombatSummary } from '../../encounters/combatData.js';
import { getRuntimeValue, setRuntimeObject, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { hasTwoWeaponFighting, collectWeaponMastery } from '../../combat/automation/automationService.js';
import { applyDamageToTarget } from '../../rules/combat/applyDamage.js';
import { addEntry } from '../../ui/logService.js';
import { getAttackRiderOptions, getAttackRiderOptionsByContext } from '../../automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';
import { sendBardicInspirationOffensePrompt } from '../../combat/prompts/bardicInspirationPromptUtils.js';
import { hasBardicInspirationOffense, getBardicInspirationDieSize } from '../../combat/auras/bardicInspirationState.js';
import { spendResource } from '../../automation/common/resourceCheck.js';
import { getActiveBuffs } from '../../automation/common/buffToggle.js';
import utils from '../../ui/utils.js';
import { featureModules } from './features/index.js';
import { applyMasteryEffect } from '../../automation/handlers/combat/weaponMasteryHandler.js';
import { getDistanceFeet } from '../../rules/combat/rangeValidation.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';

/**
 * Build the damage pipeline steps for a weapon-type action.
 * Each step: { name, subscribe, emit, condition(ctx), handler(ctx) → result|null }
 */
export function buildDamageSteps() {

  // Shared helpers used by multiple steps - these receive ctx at call time

  return [

    // =========================================================
    // Step: housekeeping — clear per-round flags
    // =========================================================
    {
      name: 'housekeeping',
      subscribe: 'housekeeping:do',
      emit: 'maneuvers:check',
      condition: () => true,
      handler: async (ctx) => {
        // Clear stale Stalker's Flurry state from previous turns
        const sfOptKey = `_${"Stalker's Flurry".replace(/\s+/g, '_')}_option`;
        setRuntimeValue(ctx.playerStats.name, sfOptKey, null, ctx.campaignName);
        setRuntimeValue(ctx.playerStats.name, 'stalkersFlurryChosenTarget', null, ctx.campaignName);
        setRuntimeValue(ctx.playerStats.name, 'pendingSuddenStrike', null, ctx.campaignName);
        setRuntimeValue(ctx.playerStats.name, 'pendingSuddenStrikeTarget', null, ctx.campaignName);

        const isBonus = ctx.attack?.type === 'Bonus Action';
        if (ctx.attack?.name === 'Horde Breaker' && isBonus) {
          const choice = getRuntimeValue(ctx.playerStats.name, "_Hunter's_Prey_choice", ctx.campaignName);
          if (choice === 'Horde Breaker') {
            setRuntimeValue(ctx.playerStats.name, '_Hunters_Prey_HordeBreaker_UsedRound', getCurrentCombatRound(), ctx.campaignName);
          }
        }
        return { data: { isBonusActionAttack: isBonus } };
      },
    },

    // =========================================================
    // Step: attackRiderManeuvers — Battle Master modal prompt
    // =========================================================
    {
      name: 'attackRiderManeuvers',
      subscribe: 'maneuvers:check',
      emit: 'maneuvers:handled',
      condition: (ctx) => !!ctx.setAttackRiderManeuverPrompt,
      handler: async (ctx) => {
        const info = {
          weaponType: ctx.attack?.weaponType,
          isUnarmedStrike: ctx.attack?.weaponType === 'unarmed',
          targetName: ctx.targetName,
        };
        const isHit = ctx.popupHtml?.hit === true || ctx.popupHtml?.isCrit === true;
        if (isHit) {
          const available = await getAttackRiderOptions(ctx.playerStats, ctx.campaignName, info);
          if (available.length > 0) {
            ctx.setAttackRiderManeuverPrompt?.({ maneuvers: available, attack: ctx.attack, popupHtml: ctx.popupHtml });
            return {
              modal: {
                type: 'attackRiderManeuver',
                props: { maneuvers: available, attack: ctx.attack, popupHtml: ctx.popupHtml },
              },
            };
          }
        }
        const isMiss = ctx.popupHtml?.hit === false && ctx.popupHtml?.isCrit !== true;
        if (isMiss) {
          const available = await getAttackRiderOptionsByContext(ctx.playerStats, ctx.campaignName, info, 'miss');
          if (available.length > 0) {
            ctx.setAttackRiderManeuverPrompt?.({ maneuvers: available, attack: ctx.attack, popupHtml: ctx.popupHtml, isMiss: true });
            return {
              modal: {
                type: 'attackRiderManeuver',
                props: { maneuvers: available, attack: ctx.attack, popupHtml: ctx.popupHtml, isMiss: true },
              },
            };
          }
        }
        return { data: {} };
      },
    },

    // =========================================================
    // Step: cunningStrike — Rogue Cunning Strike modal
    // =========================================================
    {
      name: 'cunningStrike',
      subscribe: 'maneuvers:handled',
      emit: 'cunning:checked',
      condition: (ctx) => ctx.hit,
      handler: async (ctx) => {
        const summary = await loadCombatSummary(ctx.campaignName);
        const lastResult = summary?.lastAttack;
        const attackHit = lastResult?.hit === true || lastResult?.isCrit === true;
        if (!attackHit) return { data: { sneakDice: 0 } };

        const buildFn = ctx.mapName ? ctx.buildCtx : ctx.buildCtxSync;
        const buildResult = buildFn ? await buildFn(ctx.attack) : null;
        const sneakDice = buildResult?.sneakAttackDice || 0;

        const passives = ctx.playerStats.automation?.passives || [];
        const csPassive =
          passives.find(p => p.name === 'Devious Strikes' && p.type === 'attack_rider') ||
          passives.find(p => p.name === 'Improved Cunning Strike' && p.type === 'attack_rider') ||
          passives.find(p => p.name === 'Cunning Strike' && p.type === 'attack_rider');
        if (csPassive && sneakDice > 0) {
          const round = getCurrentCombatRound();
          const used = getRuntimeValue(ctx.playerStats.name, '_CunningStrike_usedRound', ctx.campaignName);
          const skipped = getRuntimeValue(ctx.playerStats.name, '_cunningStrikeSkippedRound', ctx.campaignName);
          if (used !== round && skipped !== round) {
            const cs = await getCombatContext(ctx.campaignName);
            const target = cs ? getTargetFromAttacker(cs, ctx.playerStats.name) : null;
            ctx.setAttackRiderModal?.({
              action: csPassive,
              playerStats: ctx.playerStats,
              campaignName: ctx.campaignName,
              targetName: target?.name || null,
            });
            return {
              data: { _cunningStrike: true, sneakDice },
              modal: {
                type: 'cunningStrike',
                props: {
                  action: csPassive,
                  playerStats: ctx.playerStats,
                  campaignName: ctx.campaignName,
                  targetName: target?.name || null,
                },
              },
            };
          }
          if (skipped === round) {
            setRuntimeValue(ctx.playerStats.name, '_cunningStrikeSkippedRound', null, ctx.campaignName);
          }
        }
        return { data: { sneakDice } };
      },
    },

    // =========================================================
    // Step: bardicInspirationOffense
    // =========================================================
    {
      name: 'bardicInspirationOffense',
      subscribe: 'cunning:checked',
      emit: 'bi:checked',
      condition: (ctx) => ctx.hit,
      handler: async (ctx) => {
        const hasOffense = hasBardicInspirationOffense(ctx.playerStats.name, ctx.campaignName);
        if (!hasOffense) return { data: {} };

        const dieSize = getBardicInspirationDieSize(ctx.playerStats.name, ctx.campaignName);
        const raw = getRuntimeValue(ctx.playerStats.name, 'bardicInspirationUses', ctx.campaignName);
        const uses = (typeof raw === 'object' && raw !== null) ? raw.current
          : (raw != null ? Number(raw) : (ctx.playerStats?._trackedResources?.bardicInspirationUses?.current ?? 0));
        if (!dieSize || uses <= 0) return null;

        const targetName = ctx.targetName || 'unknown target';
        const promptId = `bi-offense-${utils.guid()}`;
        sendBardicInspirationOffensePrompt(ctx.campaignName, ctx.playerStats.name, targetName, dieSize, promptId);

        let biResolved = false;
        await new Promise(resolve => {
          const handler = event => {
            if (event.detail.promptId !== promptId) return;
            window.removeEventListener('bardic-inspiration-offense-result', handler);
            biResolved = true;
            if (event.detail.used) {
              const biRoll = event.detail.biRoll;
              spendResource(ctx.playerStats.name, 'bardicInspirationUses', 1, ctx.campaignName);
              setRuntimeObject(ctx.playerStats.name, { bardicInspirationOffenseValue: String(biRoll) }, ctx.campaignName, true);
              addEntry(ctx.campaignName, {
                type: 'ability_use',
                characterName: ctx.playerStats.name,
                abilityName: 'Combat Inspiration - Offense',
                description: `${ctx.playerStats.name} used Combat Inspiration - Offense, rolling ${biRoll} (d${dieSize}) bonus damage against ${targetName}.`,
                biDieRoll: biRoll,
                timestamp: Date.now(),
              }).catch(() => {});
            }
            resolve();
          };
          window.addEventListener('bardic-inspiration-offense-result', handler);
          setTimeout(() => {
            if (!biResolved) {
              window.removeEventListener('bardic-inspiration-offense-result', handler);
              resolve();
            }
          }, 30000);
        });
        return { data: {} };
      },
    },

    // =========================================================
    // Step: rollBaseDamage — Roll attack damage dice
    // Supports: crit doubling, overchannel maximization, empowered evocation
    // =========================================================
    {
      name: 'rollBaseDamage',
      subscribe: 'bi:checked',
      emit: 'damage:rolled',
      condition: (ctx) => !!ctx.attack?.damage || !!ctx.autoFormulaOverride,
      handler: async (ctx) => {
        const wasCrit = ctx.isCrit;
        if (wasCrit && ctx.setPopupHtml) ctx.setPopupHtml(null);

        let formula = ctx.autoFormulaOverride || ctx.attack.damage;

        // Empowered Evocation: add int mod to evocation cantrip damage
        const empEvocMod = ctx.empoweredEvocationModifier || 0;
        if (empEvocMod > 0) {
          formula = `${formula} + ${empEvocMod} [Empowered Evocation]`;
        }

        const isOverchannel = ctx.overchannelActive;
        const result = isOverchannel
          ? rollExpressionMaximized(formula)
          : (wasCrit ? rollExpressionDoubled(formula) : rollExpression(formula));
        if (!result) return null;

        return {
          data: { formula, total: result.total, rolls: result.rolls, modifier: result.modifier },
        };
      },
    },

    // =========================================================
    // Step: buildContext — Build attack context (sneak dice, etc.)
    // =========================================================
    {
      name: 'buildContext',
      subscribe: 'damage:rolled',
      emit: 'context:built',
      condition: (ctx) => !ctx.buildCtxResult && !ctx.autoDamageSource,
      handler: async (ctx) => {
        const buildFn = ctx.mapName ? ctx.buildCtx : ctx.buildCtxSync;
        if (!buildFn) return { data: {} };

        const buildResult = await buildFn(ctx.attack);
        const sneakDice = buildResult?.sneakAttackDice || 0;
        const data = { buildCtxResult: buildResult, sneakDice };
        if (!ctx.targetName && buildResult?.targetName) data.targetName = buildResult.targetName;
        return { data };
      },
    },

    // =========================================================
    // Step: sneakAttack — Apply Sneak Attack dice
    // =========================================================
    {
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
            await setRuntimeValue(ctx.playerStats.name, '_SneakAttack_usedRound', getCurrentCombatRound(), ctx.campaignName);
          }
        }

        if (cost > 0) {
          await setRuntimeValue(ctx.playerStats.name, '_cunningStrikeCostUsed', 0, ctx.campaignName);
        }

        return { data: { formula, total, rolls, effectiveSneakDice: effective } };
      },
    },

    // =========================================================
    // Step: twoWeaponFighting — TWF ability mod bonus
    // =========================================================
    {
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
    },

    // =========================================================
    // Step: targetEffects — Rider effects from target
    // =========================================================
    {
      name: 'targetEffects',
      subscribe: 'twf:applied',
      emit: 'effects:applied',
      condition: () => true,
      handler: async (ctx) => {
        const raw = getRuntimeValue(ctx.campaignName, 'targetEffects');
        const stored = Array.isArray(raw) ? raw : [];
        const riders = stored.filter(te => te.effect === 'damage_bonus' && te.damageExpression);
        if (riders.length === 0) return { data: {} };

        let formula = ctx.formula;
        let total = ctx.total;
        let rolls = [...(ctx.rolls || [])];

        for (const te of riders) {
          const r = rollExpression(te.damageExpression);
          if (r) {
            const dt = te.damageType || ctx.attack?.damageType || 'same_as_weapon';
            formula += ` + ${te.damageExpression} [${dt}]`;
            total += r.total;
            rolls = [...rolls, ...r.rolls];
          }
        }
        return { data: { formula, total, rolls } };
      },
    },

    // =========================================================
    // Step: superiorityDieBonuses — Consume stored superiority values
    // =========================================================
    {
      name: 'superiorityDieBonuses',
      subscribe: 'effects:applied',
      emit: 'superiority:applied',
      condition: () => true,
      handler: async (ctx) => {
        let formula = ctx.formula;
        let total = ctx.total;
        let rolls = [...(ctx.rolls || [])];
        const defaultDmg = ctx.attack?.damageType || 'same_as_weapon';

        const consume = (key, label) => {
          const raw = getRuntimeValue(ctx.playerStats.name, key, ctx.campaignName);
          if (raw && Number(raw) > 0) {
            const val = Number(raw);
            formula += ` + ${val} [${label}]`;
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
    },

    // =========================================================
    // Step: automationBonuses — Rage, Frenzy, Divine Fury, riders
    // =========================================================
    {
      name: 'automationBonuses',
      subscribe: 'superiority:applied',
      emit: 'automation:applied',
      condition: (ctx) => ctx.isMeleeOrUnarmed && !!ctx.playerStats.automation?.actions,
      handler: async (ctx) => {
        let formula = ctx.formula;
        let total = ctx.total;
        let rolls = [...(ctx.rolls || [])];
        const actions = ctx.playerStats.automation.actions || [];

        // melee_weapon_hit
        for (const a of actions.filter(x => x.type === 'damage_bonus' && x.trigger === 'melee_weapon_hit')) {
          const r = rollExpression(a.damageExpression);
          if (r) { formula += ` + ${a.damageExpression} [${a.damageType}]`; total += r.total; rolls = [...rolls, ...r.rolls]; }
        }

        // monk_weapon_or_unarmed_hit
        for (const a of actions.filter(x => x.type === 'damage_bonus' && x.trigger === 'monk_weapon_or_unarmed_hit')) {
          const r = rollExpression(a.damageExpression);
          if (r) {
            const dt = (getRuntimeValue(ctx.playerStats.name, '_Elemental_Attunement_option', ctx.campaignName) || 'fire').toLowerCase();
            formula += ` + ${a.damageExpression} [${dt}]`; total += r.total; rolls = [...rolls, ...r.rolls];
          }
        }

        // melee_heavy_weapon_hit (GWM)
        const heavy = actions.filter(x => x.type === 'damage_bonus' && x.trigger === 'melee_heavy_weapon_hit');
        if (heavy.length > 0 && (ctx.attack?.properties || []).includes('Heavy')) {
          for (const a of heavy) {
            const r = rollExpression(a.damageExpression);
            if (r) {
              const dt = a.damageType || ctx.attack?.damageType || 'Slashing';
              formula += ` + ${a.damageExpression} [${dt === 'same_as_weapon' ? 'Slashing' : dt}]`;
              total += r.total; rolls = [...rolls, ...r.rolls];
            }
          }
        }

        // Frenzy
        const frenzy = actions.filter(x => x.type === 'damage_bonus' && x.trigger === 'reckless_attack_hit_while_raging');
        if (frenzy.length > 0) {
          const used = getRuntimeValue(ctx.playerStats.name, '_frenzyUsedRound', ctx.campaignName);
          const round = getCurrentCombatRound();
          if (used !== round) {
            const buffs = getRuntimeValue(ctx.playerStats.name, 'activeBuffs', ctx.campaignName) || [];
            const isReckless = buffs.some(b => b.effect === 'advantage_attacks_advantage_against');
            const isRaging = buffs.some(b => b.damageBonusExpression);
            const isStr = (ctx.attack?.abilityName || '').toLowerCase() === 'strength';
            if (isReckless && isRaging && isStr) {
              for (const a of frenzy) {
                let expr = a.damageExpression || '';
                const rd = ctx.playerStats.class?.class_levels?.[(ctx.playerStats.level || 1) - 1]?.rage_damage ?? 2;
                expr = expr.replace(/rage_damage/g, rd);
                const r = rollExpression(expr);
                if (r) { formula += ` + ${expr} [${a.damageType}]`; total += r.total; rolls = [...rolls, ...r.rolls]; }
              }
              setRuntimeValue(ctx.playerStats.name, '_frenzyUsedRound', round, ctx.campaignName);
            }
          }
        }

        // Divine Fury
        const df = actions.filter(x => x.type === 'damage_bonus' && x.trigger === 'first_hit_while_raging');
        if (df.length > 0) {
          const used = getRuntimeValue(ctx.playerStats.name, '_divineFuryUsedRound', ctx.campaignName);
          const round = getCurrentCombatRound();
          if (used !== round) {
            const buffs = getRuntimeValue(ctx.playerStats.name, 'activeBuffs', ctx.campaignName) || [];
            const isRaging = buffs.some(b => b.damageBonusExpression);
            if (isRaging) {
              const a = df[0];
              let expr = a.damageExpression || '';
              expr = expr.replace(/barbarian_level\s*\/\s*2/gi, String(Math.floor(ctx.playerStats.level / 2)))
                .replace(/barbarian_level/gi, String(ctx.playerStats.level));
              const r = rollExpression(expr);
              if (r) {
                const dt = a.damageType || '';
                if (dt.includes(' or ')) {
                  ctx.setDivineFuryChoice?.(dt);
                  return {
                    data: { _divineFuryPending: true, bonusExpr: expr, bonusTotal: r.total, bonusRolls: r.rolls },
                    modal: { type: 'divineFury', props: { damageType: dt } },
                  };
                }
                formula += ` + ${expr} [${dt}]`; total += r.total; rolls = [...rolls, ...r.rolls];
              }
              setRuntimeValue(ctx.playerStats.name, '_divineFuryUsedRound', round, ctx.campaignName);
            }
          }
        }

        // attack_rider (Brutal Strike)
        for (const a of actions.filter(x => x.type === 'attack_rider' && x.damageExpression && x.trigger === 'strength_attack_hit_after_reckless')) {
          const r = rollExpression(a.damageExpression);
          if (r) { formula += ` + ${a.damageExpression} [${a.damageType || 'same_as_weapon'}]`; total += r.total; rolls = [...rolls, ...r.rolls]; }
        }

        return { data: { formula, total, rolls } };
      },
    },

    // =========================================================
    // Step: weaponHitBonuses — Divine Strike, Primal Strike
    // =========================================================
    {
      name: 'weaponHitBonuses',
      subscribe: 'automation:applied',
      emit: 'weapon_hit:applied',
      condition: (ctx) => !!ctx.playerStats.automation?.actions,
      handler: async (ctx) => {
        let formula = ctx.formula;
        let total = ctx.total;
        let rolls = [...(ctx.rolls || [])];

        const all = [...(ctx.playerStats.automation.actions || []), ...(ctx.playerStats.automation.passives || [])];
        const upgraded = new Set(all.filter(b => b.upgrades).map(b => b.upgrades));

        const bonuses = ctx.playerStats.automation.actions.filter(
          a => a.type === 'damage_bonus' && (a.trigger === 'weapon_attack_hit' || a.trigger === 'weapon_or_beast_form_attack_hit')
        ).filter(b => !upgraded.has(b.name));

        for (const bonus of bonuses) {
          const optKey = `_${(bonus.upgrades || bonus.name).replace(/\s+/g, '_')}_option`;
          const chosen = getRuntimeValue(ctx.playerStats.name, optKey, ctx.campaignName);
          if (bonus.options?.length > 0) {
            if (!chosen) continue;
            if (!chosen.toLowerCase().includes('strike')) continue;
          }

          const usedKey = `_${bonus.name.replace(/\s+/g, '_')}_usedRound`;
          const round = getCurrentCombatRound();
          if (bonus.oncePerTurn && getRuntimeValue(ctx.playerStats.name, usedKey, ctx.campaignName) === round) continue;

          if (bonus.uses_expression && bonus.recharge) {
            const usesKey = `_${bonus.name.replace(/\s+/g, '_')}_uses`;
            const cur = Number(getRuntimeValue(ctx.playerStats.name, usesKey, ctx.campaignName) ?? bonus.usesMax);
            if (cur <= 0) continue;
          }

          const r = rollExpression(bonus.damageExpression);
          if (!r) continue;

          const dt = bonus.damageType || '';
          if (dt.includes(' or ')) {
            return {
              data: { _weaponHitPending: true, bonusExpr: bonus.damageExpression, bonusTotal: r.total, bonusRolls: r.rolls, _weaponHitOnceKey: usedKey },
              modal: { type: 'damageTypeChoice', props: { title: `${bonus.name} — Damage Type`, types: dt.split(/\s+or\s+/).flatMap(t => t.split(/\s+/)).filter(Boolean) } },
            };
          }
          formula += ` + ${bonus.damageExpression} [${dt}]`;
          total += r.total;
          rolls = [...rolls, ...r.rolls];

          if (bonus.oncePerTurn) setRuntimeValue(ctx.playerStats.name, usedKey, round, ctx.campaignName);
          if (bonus.uses_expression && bonus.recharge) {
            const usesKey = `_${bonus.name.replace(/\s+/g, '_')}_uses`;
            const cur = Number(getRuntimeValue(ctx.playerStats.name, usesKey, ctx.campaignName) ?? bonus.usesMax);
            if (cur > 0) setRuntimeValue(ctx.playerStats.name, usesKey, cur - 1, ctx.campaignName);
          }
        }

        return { data: { formula, total, rolls } };
      },
    },

    // =========================================================
    // Step: natural20Bonuses — Overwhelming Strike, etc.
    // =========================================================
    {
      name: 'natural20Bonuses',
      subscribe: 'weapon_hit:applied',
      emit: 'n20:applied',
      condition: (ctx) => ctx.isNatural20 && !!ctx.playerStats.automation?.actions,
      handler: async (ctx) => {
        let formula = ctx.formula;
        let total = ctx.total;
        let rolls = [...(ctx.rolls || [])];
        const round = getCurrentCombatRound();

        for (const a of ctx.playerStats.automation.actions.filter(x => x.type === 'damage_bonus' && x.trigger === 'natural_20_attack_roll')) {
          const usedKey = `_${a.name.replace(/\s+/g, '_')}_usedRound`;
          if (getRuntimeValue(ctx.playerStats.name, usedKey, ctx.campaignName) === round) continue;

          let expr = a.extraDamageExpression || '';
          if (expr === 'increased_ability_score') {
            const abil = ctx.playerStats.abilities?.find(x => x.name === (a.abilityIncreased || 'Strength'));
            expr = abil?.bonus || 0;
          }
          if (expr) {
            const dt = a.extraDamageType === 'same_as_attack' ? (ctx.attack?.damageType || '') : (a.extraDamageType || a.damageType || '');
            const r = rollExpression(String(expr));
            if (r) {
              formula += ` + ${expr} [${dt || 'same_as_attack'}]`;
              total += r.total;
              rolls = [...rolls, ...r.rolls];
            }
          }
          setRuntimeValue(ctx.playerStats.name, usedKey, round, ctx.campaignName);
        }

        return { data: { formula, total, rolls } };
      },
    },

    // =========================================================
    // Step: celestialRevelation — Aasimar transformation
    // =========================================================
    {
      name: 'celestialRevelation',
      subscribe: 'n20:applied',
      emit: 'celestial:applied',
      condition: (ctx) => !!ctx.playerStats.automation?.passives,
      handler: async (ctx) => {
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
        const round = getCurrentCombatRound();
        if (rider.oncePerTurn && getRuntimeValue(ctx.playerStats.name, usedKey, ctx.campaignName) === round) return { data: {} };

        const r = rollExpression(rider.damageExpression);
        if (r) {
          const formula = `${ctx.formula} + ${rider.damageExpression} [${rider.damageType || ''}]`;
          const total = ctx.total + r.total;
          const rolls = [...(ctx.rolls || []), ...r.rolls];
          if (rider.oncePerTurn) setRuntimeValue(ctx.playerStats.name, usedKey, round, ctx.campaignName);
          return { data: { formula, total, rolls } };
        }
        return { data: {} };
      },
    },

    // =========================================================
    // Step: featureRiders — dispatches to individual feature modules
    // =========================================================
    {
      name: 'featureRiders',
      subscribe: 'celestial:applied',
      emit: 'riders:applied',
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
    // Step: damageTypeModifiers — Unarmed damage type / riders
    // =========================================================
    {
      name: 'damageTypeModifiers',
      subscribe: 'riders:applied',
      emit: 'dmg_type:modified',
      condition: (ctx) => ctx.attack?.weaponType === 'unarmed' && !!ctx.playerStats.automation?.passives,
      handler: async (ctx) => {
        let formula = ctx.formula;
        let total = ctx.total;
        let rolls = [...(ctx.rolls || [])];
        const ps = ctx.playerStats;

        const dmgMods = ps.automation.passives.filter(a => a.type === 'damage_type_modifier' && a.trigger === 'unarmed_strike_hit');
        for (const mod of dmgMods) {
          const key = `_${mod.name.replace(/\s+/g, '_')}_usedRound`;
          const round = getCurrentCombatRound();
          if (mod.oncePerTurn && getRuntimeValue(ps.name, key, ctx.campaignName) === round) continue;
          const stored = getRuntimeValue(ps.name, 'empoweredStrikesDamageType', ctx.campaignName);
          if (stored) { ctx.attack.damageType = stored; setRuntimeValue(ps.name, 'empoweredStrikesDamageType', null, ctx.campaignName); break; }
          if (mod.options?.length > 0) {
            return {
              modal: { type: 'damageTypeChoice', props: { title: `${mod.name} — Damage Type`, types: mod.options.map(o => o.damageType) } },
            };
          }
        }

        const riders = ps.automation.passives.filter(a => a.type === 'attack_rider' && a.trigger === 'unarmed_strike_hit' && a.chooseOne && a.options?.length > 0);
        for (const rider of riders) {
          const key = `_${rider.name.replace(/\s+/g, '_')}_usedRound`;
          const round = getCurrentCombatRound();
          if (rider.oncePerTurn && getRuntimeValue(ps.name, key, ctx.campaignName) === round) continue;
          const stored = getRuntimeValue(ps.name, `_${rider.name.replace(/\s+/g, '_')}_selectedOption`, ctx.campaignName);
          if (stored) {
            const opt = rider.options.find(o => o.name === stored);
            if (opt?.effect === 'damage_bonus') {
              const rr = rollExpression(opt.damageExpression);
              if (rr) {
                formula += ` + ${opt.damageExpression} [${opt.damageType || 'same_as_weapon'}]`;
                total += rr.total;
                rolls = [...rolls, ...rr.rolls];
              }
              setRuntimeValue(ps.name, `_${rider.name.replace(/\s+/g, '_')}_selectedOption`, null, ctx.campaignName);
            }
            continue;
          }
          if (rider.options?.length > 0) {
            return {
              modal: { type: 'damageTypeChoice', props: { title: `${rider.name} — Enhanced Unarmed Strike`, types: rider.options.map(o => o.name) } },
            };
          }
        }

        return { data: { formula, total, rolls } };
      },
    },

    // =========================================================
    // Step: overchannel — Wizard Overchannel self-damage
    // =========================================================
    {
      name: 'overchannel',
      subscribe: 'dmg_type:modified',
      emit: 'damage:ready',
      condition: (ctx) => ctx.overchannelActive && ctx.overchannelUseCount > 1,
      handler: async (ctx) => {
        const dicePerLevel = 2 + (ctx.overchannelUseCount - 1);
        const totalDice = dicePerLevel * ctx.overchannelSpellLevel;
        const r = rollExpression(`${totalDice}d12`);
        if (r) {
          const cs = await loadCombatSummary(ctx.campaignName);
          const app = applyDamageToTarget(cs, ctx.playerStats.name, r.total, ['Necrotic'], ctx.campaignName, null, true, ctx.playerStats.name);
          addEntry(ctx.campaignName, { type: 'roll', characterName: ctx.playerStats.name, rollType: 'overchannel-damage', name: 'Overchannel', formula: `${totalDice}d12`, rolls: r.rolls, total: r.total, modifier: r.modifier, damageType: 'Necrotic', targetName: ctx.playerStats.name, finalDamage: app?.finalDamage, note: 'Overchannel self-damage (ignores resistance/immunity)' }).catch((e) => { console.error("[damagePipeline] Error:", e); });
        }
        return { data: {} };
      },
    },

    // =========================================================
    // Step: proceedToDamage — proceedWithDamage
    // =========================================================
    {
      name: 'proceedToDamage',
      subscribe: 'damage:ready',
      emit: 'damage:applied',
      condition: (ctx) => ctx.formula != null,
      handler: async (ctx) => {
        ctx.proceedWithDamage(ctx.attack, ctx.formula, ctx.total, ctx.rolls, ctx.modifier);
        return { data: { _done: true } };
      },
    },

    // =========================================================
    // Step: stalkersFlurryPostDamage — Sudden Strike secondary attack
    // =========================================================
    {
      name: 'stalkersFlurryPostDamage',
      subscribe: 'damage:applied',
      emit: 'cleave:check',
      condition: (ctx) => !!ctx.playerStats.automation?.passives,
      handler: async (ctx) => {
        const secondaryTarget = getRuntimeValue(ctx.playerStats.name, 'pendingSuddenStrikeTarget', ctx.campaignName);
        const pending = getRuntimeValue(ctx.playerStats.name, 'pendingSuddenStrike', ctx.campaignName);
        if (pending && secondaryTarget && ctx.total > 0) {
          ctx.setPopupHtml?.(null);
          ctx.setAttackRiderModal?.(null);
          const cs = await getCombatContext(ctx.campaignName);
          const characters = getRuntimeValue('characters', 'characters', ctx.campaignName) || [];
          applyDamageToTarget(cs, secondaryTarget, ctx.total, [ctx.attack.damageType], ctx.campaignName, characters, false, ctx.playerStats.name, false, { isAutoCrit: ctx.isCrit });
          await addEntry(ctx.campaignName, {
            type: 'ability_use',
            characterName: ctx.playerStats.name,
            abilityName: "Stalker's Flurry - Sudden Strike",
            description: `Sudden Strike: ${ctx.total} damage to ${secondaryTarget} (same as primary attack).`,
          }).catch(() => {});
          setRuntimeValue(ctx.playerStats.name, 'pendingSuddenStrike', null, ctx.campaignName);
          setRuntimeValue(ctx.playerStats.name, 'pendingSuddenStrikeTarget', null, ctx.campaignName);
        }
        return { data: {} };
      },
    },

    // =========================================================
    // Step: cleaveMastery — Secondary target selection for Cleave
    // =========================================================
    {
      name: 'cleaveMastery',
      subscribe: 'cleave:check',
      emit: 'cleave:done',
      condition: (ctx) => !!ctx.setSecondaryTargetModal && ctx.attack?.name && ctx.playerStats?.automation,
      handler: async (ctx) => {
        const cs = await loadCombatSummary(ctx.campaignName);
        const lastAttack = cs?.lastAttack;
        if (!lastAttack?.hit) return { data: {} };

        const available = collectWeaponMastery(lastAttack.attackName, ctx.playerStats);
        if (!available) return { data: {} };
        const allMasteries = [available.baseMastery, ...(available.extraMasteries || [])].filter(Boolean);
        if (!allMasteries.includes('Cleave')) return { data: {} };

        const firstTarget = cs?.creatures?.find(c => c.name === lastAttack.targetName);
        const mapName = ctx.playerStats?.mapName;
        const hasMapPositions = mapName && firstTarget?.position;

        const resolveHp = (creature, ps) => {
          if (!creature) return { currentHp: 0, maxHp: 0 };
          if (creature.type === 'player') {
            const currentHp = getRuntimeValue(creature.name, 'currentHitPoints') ?? getRuntimeValue(creature.name, 'hitPoints') ?? 0;
            const maxHp = getRuntimeValue(creature.name, 'hitPoints') ?? ps?.hitPoints ?? 0;
            return { currentHp, maxHp };
          }
          return { currentHp: creature.currentHp ?? creature.maxHp, maxHp: creature.maxHp };
        };

        let secondTargets;
        if (hasMapPositions) {
          const attackerPos = cs?.creatures?.find(c => c.name === ctx.playerStats.name)?.position;
          const reach = 8;
          if (attackerPos) {
            secondTargets = cs.creatures
              .filter(c => c.name !== lastAttack.targetName && c.position)
              .map(c => ({
                ...c,
                ...resolveHp(c, ctx.playerStats),
                distanceFromFirst: getDistanceFeet(firstTarget.position, c.position),
                distanceFromAttacker: getDistanceFeet(attackerPos, c.position),
              }))
              .filter(t => t.distanceFromFirst !== null && t.distanceFromFirst <= 5 && t.distanceFromAttacker !== null && t.distanceFromAttacker <= reach);
          }
        }

        if (!hasMapPositions || !secondTargets) {
          secondTargets = cs.creatures
            .filter(c => c.name !== lastAttack.targetName)
            .map(c => ({ ...c, ...resolveHp(c, ctx.playerStats) }));
        }

        if (secondTargets.length === 0) return { data: {} };

        // Store attack info for Cleave secondary attack
        const cleaveDamageFormula = lastAttack.damageFormula
          ? lastAttack.damageFormula.replace(/\+\s*\d+/g, '').trim()
          : lastAttack.damageFormula;

        ctx._cleaveAttackInfo = {
          attackName: lastAttack.attackName,
          damageFormula: cleaveDamageFormula || lastAttack.damageFormula,
          damageType: lastAttack.damageType || 'same_as_weapon',
        };

        ctx.setSecondaryTargetModal?.({
          title: 'Cleave — Choose Second Target',
          targets: secondTargets,
          onTargetSelected: async (cleaveTargetName) => {
            if (!cleaveTargetName || !ctx.rollDamage) return;

            const combatSummary = await getCombatContext(ctx.campaignName);
            const target = combatSummary?.creatures?.find(c => c.name === cleaveTargetName);
            const targetAc = target?.ac || 0;
            const abilityName = ctx.playerStats?.abilities?.[0]?.name || 'STR';
            const ability = ctx.playerStats?.abilities?.find(a => a.name === abilityName);
            const abilityMod = ability?.bonus || 0;
            const attackBonus = abilityMod + (ctx.playerStats.proficiency || 0);
            const d20Roll = Math.floor(Math.random() * 20) + 1;
            const totalRoll = d20Roll + attackBonus;
            const hit = totalRoll >= targetAc;

            const cleaveFormula = ctx._cleaveAttackInfo?.damageFormula || '0';
            let damageResult = null;
            if (hit) {
              damageResult = rollExpression(cleaveFormula);
            }

            if (hit && damageResult) {
              const context = {
                targetName: cleaveTargetName,
                damageType: ctx._cleaveAttackInfo.damageType,
                attackerName: ctx.playerStats.name,
              };
              ctx.rollDamage(`${ctx._cleaveAttackInfo.attackName} (Cleave)`, cleaveFormula, damageResult.total, damageResult.rolls, 0, context);
              addEntry(ctx.campaignName, {
                type: 'ability_use',
                characterName: ctx.playerStats.name,
                abilityName: 'Cleave',
                description: `${ctx.playerStats.name} used Cleave on ${ctx._cleaveAttackInfo.attackName} against ${cleaveTargetName}`,
                targetName: cleaveTargetName,
              }).catch(() => {});
            } else {
              const context = {
                targetName: cleaveTargetName,
                damageType: ctx._cleaveAttackInfo.damageType,
                attackerName: ctx.playerStats.name,
                isAutoMiss: true,
              };
              ctx.rollDamage(`${ctx._cleaveAttackInfo.attackName} (Cleave)`, cleaveFormula, 0, [], 0, context);
              addEntry(ctx.campaignName, {
                type: 'ability_use',
                characterName: ctx.playerStats.name,
                abilityName: 'Cleave',
                description: `${ctx.playerStats.name} used Cleave on ${ctx._cleaveAttackInfo.attackName} against ${cleaveTargetName} — Miss`,
                targetName: cleaveTargetName,
              }).catch(() => {});
            }
          },
          onSkip: () => {},
          featureDescription: 'On a hit, the second creature takes weapon damage (no ability modifier to damage unless negative). Once per turn.',
        });

        return {
          data: { _cleavePending: true },
          modal: { type: 'cleaveTargetSelection', props: { title: 'Cleave — Choose Second Target', targets: secondTargets } },
        };
      },
    },

    // =========================================================
    // Step: tacticalMaster — Mastery replacement choice
    // =========================================================
    {
      name: 'tacticalMaster',
      subscribe: 'cleave:done',
      emit: 'tactical:done',
      condition: (ctx) => ctx.attack?.name && ctx.playerStats?.automation,
      handler: async (ctx) => {
        const cs = await loadCombatSummary(ctx.campaignName);
        const lastAttack = cs?.lastAttack;
        if (!lastAttack?.hit) return { data: {} };

        const available = collectWeaponMastery(lastAttack.attackName, ctx.playerStats);
        if (!available) return { data: {} };
        if (available.replaceMasteryOptions?.length === 0) {
          // Auto-apply mastery effects (Push, Sap, Slow, Vex, etc.)
          const allMasteries = [available.baseMastery, ...(available.extraMasteries || [])].filter(Boolean);
          const targetName = lastAttack.targetName;
          if (targetName) {
            for (const masteryName of allMasteries) {
              if (['Graze', 'Topple', 'Nick'].includes(masteryName)) continue;
              const alreadyApplied = getRuntimeValue(ctx.campaignName, `_${masteryName}_appliedTarget`, ctx.campaignName);
              if (alreadyApplied === targetName) continue;
              if (masteryName !== 'Slow') {
                setRuntimeValue(ctx.campaignName, `_${masteryName}_appliedTarget`, targetName, ctx.campaignName);
              }
              await applyMasteryEffect(masteryName, ctx.playerStats, ctx.campaignName, targetName).catch((e) => { console.error('[Mastery] Error:', e); });
            }
          }
          return { data: {} };
        }

        ctx.setModalState?.({
          tacticalMasterPending: {
            attackName: lastAttack.attackName,
            baseMastery: available.baseMastery,
            replaceOptions: available.replaceMasteryOptions,
            targetName: lastAttack.targetName,
          },
        });

        return {
          data: { _tacticalMasterPending: true },
          modal: { type: 'tacticalMaster', props: { attackName: lastAttack.attackName, baseMastery: available.baseMastery, replaceOptions: available.replaceMasteryOptions, targetName: lastAttack.targetName } },
        };
      },
    },

    // =========================================================
    // Step: toppleMastery — CON save or prone
    // =========================================================
    {
      name: 'toppleMastery',
      subscribe: 'tactical:done',
      emit: 'mastery:done',
      condition: (ctx) => ctx.attack?.name && ctx.playerStats,
      handler: async (ctx) => {
        const cs = await loadCombatSummary(ctx.campaignName);
        const lastAttack = cs?.lastAttack;
        if (!lastAttack?.hit) return { data: {} };

        const available = collectWeaponMastery(lastAttack.attackName, ctx.playerStats);
        if (!available) return { data: {} };
        const allMasteries = [available.baseMastery, ...(available.extraMasteries || [])].filter(Boolean);
        if (!allMasteries.includes('Topple')) return { data: {} };

        const toppleTargetName = lastAttack.targetName;
        if (!toppleTargetName) return { data: {} };

        const weaponAttack = ctx.playerStats.attacks?.find(a => a.name === lastAttack.attackName);
        const abilityName = weaponAttack?.abilityName || 'Strength';
        const ability = ctx.playerStats.abilities?.find(a => a.name === abilityName);
        const abilityMod = ability?.bonus || 0;
        const prof = ctx.playerStats.proficiency || 0;
        const saveDc = 8 + abilityMod + prof;

        const { promptId, promise } = createSaveListener(ctx.campaignName, {
          targetName: toppleTargetName,
          saveType: 'CON',
          saveDc,
        });

        addEntry(ctx.campaignName, {
          type: 'save_triggered',
          characterName: ctx.playerStats.name,
          targetName: toppleTargetName,
          saveType: 'CON',
          saveDc,
          description: `Topple: ${toppleTargetName} must make a DC ${saveDc} CON save (weapon ${abilityName}) or fall Prone.`,
          promptId,
        }).catch(() => {});

        const result = await promise;

        if (result && !result.success) {
          const storedConditions = getRuntimeValue(toppleTargetName, 'activeConditions') || [];
          const conditions = Array.isArray(storedConditions) ? storedConditions : [];
          if (!conditions.includes('prone')) {
            await setRuntimeValue(toppleTargetName, 'activeConditions', [...conditions, 'prone'], ctx.campaignName);
          }

          addEntry(ctx.campaignName, {
            type: 'save_result',
            characterName: ctx.playerStats.name,
            rollType: 'save-topple',
            targetName: toppleTargetName,
            saveDc,
            saveType: 'CON',
            success: false,
            description: `${toppleTargetName} failed CON save vs Topple. Gains Prone condition.`,
          }).catch(() => {});

          addEntry(ctx.campaignName, {
            type: 'ability_use',
            characterName: ctx.playerStats.name,
            abilityName: 'Topple',
            description: `${ctx.playerStats.name} used Topple on ${toppleTargetName} — target failed CON save (DC ${saveDc}, weapon ${abilityName}), fell Prone.`,
            targetName: toppleTargetName,
          }).catch(() => {});
        }

        return { data: {} };
      },
    },

    // =========================================================
    // Step: masteryDone — Final step
    // =========================================================
    {
      name: 'masteryDone',
      subscribe: 'mastery:done',
      emit: 'pipeline:complete',
      condition: () => true,
      handler: async () => {
        return { data: { _pipelineComplete: true } };
      },
    },
  ];
}
