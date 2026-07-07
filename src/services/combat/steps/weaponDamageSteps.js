import { rollExpression, rollExpressionDoubled } from '../../dice/diceRoller.js';
import { getCombatContext, getTargetFromAttacker } from '../../rules/combat/damageUtils.js';
import { getCurrentCombatRound, loadCombatSummary } from '../../encounters/combatData.js';
import { getRuntimeValue, setRuntimeObject, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { evaluateAutoExpression, hasTwoWeaponFighting } from '../../combat/automation/automationService.js';
import { applyDamageToTarget } from '../../rules/combat/applyDamage.js';
import { parseMagicItemName } from '../../rules/core/attackCalc.js';
import { addEntry } from '../../ui/logService.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { getAttackRiderOptions, getAttackRiderOptionsByContext } from '../../automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';
import { sendBardicInspirationOffensePrompt } from '../../combat/prompts/bardicInspirationPromptUtils.js';
import { hasBardicInspirationOffense, getBardicInspirationDieSize } from '../../combat/auras/bardicInspirationState.js';
import { spendResource } from '../../automation/common/resourceCheck.js';
import { getActiveBuffs } from '../../automation/common/buffToggle.js';
import utils from '../../ui/utils.js';

/**
 * Build the damage pipeline steps for a weapon-type action.
 * Each step: { name, subscribe, emit, condition(ctx), handler(ctx) → result|null }
 */
export function buildWeaponDamageSteps() {

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
        const isBonus = ctx.attack?.type === 'Bonus Action';
        if (isBonus) {
          const pending = getRuntimeValue(ctx.playerStats.name, 'pendingSuddenStrike', ctx.campaignName);
          if (pending) setRuntimeValue(ctx.playerStats.name, 'pendingSuddenStrike', null, ctx.campaignName);
        }
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
    // =========================================================
    {
      name: 'rollBaseDamage',
      subscribe: 'bi:checked',
      emit: 'damage:rolled',
      condition: (ctx) => !!ctx.attack?.damage || !!ctx.autoFormulaOverride,
      handler: async (ctx) => {
        const wasCrit = ctx.isCrit;
        if (wasCrit && ctx.setPopupHtml) ctx.setPopupHtml(null);

        const formula = ctx.autoFormulaOverride || ctx.attack.damage;
        const result = wasCrit ? rollExpressionDoubled(formula) : rollExpression(formula);
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
      condition: (ctx) => !ctx.buildCtxResult,
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
            const isReckless = buffs.some(b => b.effect === 'advantage_attacks_disadvantage_against');
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
          const optKey = `_${bonus.name.replace(/\s+/g, '_')}_option`;
          const chosen = getRuntimeValue(ctx.playerStats.name, optKey, ctx.campaignName) || bonus.options?.[0] || '';
          if (bonus.options?.length > 0 && !chosen.toLowerCase().includes('strike')) continue;

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
    // Step: featureRiders — Assassinate, Rend Mind, Charger, Shield Bash,
    //        Colossus Slayer, Superior Hunter's Prey, Eldritch Strike,
    //        Stalker's Flurry, Crusher, Slasher, Piercer, Savage Attacker,
    //        Tavern Brawler, Cantrip bonuses, Sacred Weapon, Remarkable Athlete
    // =========================================================
    {
      name: 'featureRiders',
      subscribe: 'celestial:applied',
      emit: 'riders:applied',
      condition: () => true,
      handler: async (ctx) => {
        let formula = ctx.formula;
        let total = ctx.total;
        let rolls = [...(ctx.rolls || [])];
        const ps = ctx.playerStats;

        // Assassinate
        if (ps.automation?.actions) {
          const assassinate = ps.automation.actions.find(
            a => a.type === 'damage_bonus' && a.trigger === 'first_round_sneak_attack_hit'
          );
          if (assassinate) {
            const cs = await getCombatContext(ctx.campaignName);
            if (cs && getCurrentCombatRound() === 1) {
              const pc = cs.creatures?.find(c => c.name === ps.name);
              if (!pc?.hasActed) {
                const r = rollExpression(assassinate.damageExpression);
                if (r) {
                  formula += ` + ${assassinate.damageExpression} [${assassinate.damageType || 'Sneak Attack'}]`;
                  total += r.total;
                  rolls = [...rolls, ...r.rolls];
                }
              }
            }
          }
        }

        // Stealth Attack cost
        const stealthCost = getRuntimeValue(ps.name, 'stealthAttackCost', ctx.campaignName);
        if (stealthCost > 0) {
          const cl = ps.class?.class_levels?.[ps.level - 1];
          const sd = cl?.sneak_attack_num_d6 || 0;
          if (sd >= stealthCost) {
            if (cl) cl.sneak_attack_num_d6 = sd - stealthCost;
            await setRuntimeValue(ps.name, 'stealthAttackCost', 0, ctx.campaignName);
          }
        }

        // Rend Mind
        const isPsychicBlade = ctx.attack?.name?.includes('Psychic Blade');
        const effSneak = ctx.effectiveSneakDice || 0;
        if (effSneak > 0 && isPsychicBlade && ctx.targetName) {
          const rendMind = (ps.automation?.passives || []).find(
            a => a.type === 'attack_rider' && a.trigger === 'psychic_blade_sneak_attack_hit' && a.saveType
          );
          if (rendMind) {
            const key = '_RendMind_Used';
            let active = getRuntimeValue(ps.name, key, ctx.campaignName);
            if (active) {
              const llr = getRuntimeValue(ps.name, '_LastLongRest', ctx.campaignName);
              const clr = getRuntimeValue(ps.name, '_CurrentLongRest', ctx.campaignName);
              if (llr !== clr) { await setRuntimeValue(ps.name, key, false, ctx.campaignName); active = false; }
            }
            if (!active) {
              const dex = ps.abilities?.find(a => a.name === 'Dexterity');
              const dc = 8 + (dex?.bonus || 0) + (ps.proficiency || 0);
              const { promise } = createSaveListener(ctx.campaignName, { targetName: ctx.targetName, saveType: 'WIS', saveDc: dc });
              await setRuntimeValue(ps.name, key, true, ctx.campaignName);
              const sr = await promise;
              if (!sr.success) {
                const conds = getRuntimeValue(ctx.targetName, 'activeConditions') || [];
                if (!conds.some(c => String(c).toLowerCase() === 'stunned'))
                  await setRuntimeValue(ctx.targetName, 'activeConditions', [...conds, 'stunned'], ctx.campaignName);
              }
              addEntry(ctx.campaignName, { type: 'ability_use', characterName: ps.name, abilityName: 'Rend Mind', description: `Rend Mind triggered on ${ctx.targetName} — ${sr?.success ? 'succeeded' : 'failed'} WIS save (DC ${dc})${sr?.success ? '' : ' — Stunned condition applied'}`, targetName: ctx.targetName }).catch(() => {});
            }
          }
        }

        // Charger
        const charger = (ps.automation?.passives || []).find(
          a => a.type === 'attack_rider' && a.trigger === 'melee_hit_after_10ft_charge' && a.chooseOne
        );
        if (charger) {
          const key = `_${charger.name.replace(/\s+/g, '_')}_usedRound`;
          const round = getCurrentCombatRound();
          if (getRuntimeValue(ps.name, key, ctx.campaignName) !== round) {
            const cs = await getCombatContext(ctx.campaignName);
            const t = cs ? getTargetFromAttacker(cs, ps.name) : null;
            if (t?.name && charger.options?.length > 0) {
              const effs = getRuntimeValue(ctx.campaignName, 'targetEffects') || [];
              setRuntimeValue(ctx.campaignName, 'targetEffects', [...effs, { target: t.name, source: charger.name, option: charger.options[0].name, effect: charger.options[0].effect, value: charger.options[0].value || null, sizeLimit: charger.options[0].sizeLimit || null, noOpportunityAttacks: charger.options[0].noOpportunityAttacks || false, duration: 'until_start_of_next_turn' }], ctx.campaignName);
              setRuntimeValue(ps.name, key, round, ctx.campaignName);
            }
          }
        }

        // Shield Bash
        const shieldBash = (ps.automation?.passives || []).find(
          a => a.type === 'attack_rider' && a.trigger === 'melee_hit_with_shield_equipped' && a.options?.length > 0
        );
        if (shieldBash) {
          const hasShield = ps.inventory?.equipped?.some(itemName => {
            const { baseName } = parseMagicItemName(itemName);
            return ps.equipment?.find(e => e.name === baseName)?.equipment_category === 'Shield';
          });
          if (hasShield) {
            const key = `_${shieldBash.name.replace(/\s+/g, '_')}_usedRound`;
            const round = getCurrentCombatRound();
            if (getRuntimeValue(ps.name, key, ctx.campaignName) !== round) {
              const cs = await getCombatContext(ctx.campaignName);
              const t = cs ? getTargetFromAttacker(cs, ps.name) : null;
              if (t?.name) {
                const o = shieldBash.options[0];
                const effs = getRuntimeValue(ctx.campaignName, 'targetEffects') || [];
                setRuntimeValue(ctx.campaignName, 'targetEffects', [...effs, { target: t.name, source: shieldBash.name, option: o.name, effect: o.effect, value: o.value || null, sizeLimit: o.sizeLimit || null, noOpportunityAttacks: o.noOpportunityAttacks || false, duration: 'until_start_of_next_turn', saveType: o.saveType || null, saveDc: o.saveDc || null, saveAbility: o.saveAbility || null, condition: o.condition || null, repeatingSave: !!o.repeatingSave }], ctx.campaignName);
                setRuntimeValue(ps.name, key, round, ctx.campaignName);
              }
            }
          }
        }

        // Colossus Slayer
        if (getRuntimeValue(ps.name, "_Hunter's_Prey_choice", ctx.campaignName) === 'Colossus Slayer') {
          const cs = await getCombatContext(ctx.campaignName);
          const t = cs ? getTargetFromAttacker(cs, ps.name) : null;
          if (t && t.currentHp != null && t.maxHp != null && t.currentHp < t.maxHp) {
            const key = '_Hunters_Prey_Colossus_UsedRound';
            if (getRuntimeValue(ps.name, key, ctx.campaignName) !== getCurrentCombatRound()) {
              const r = rollExpression('1d8');
              if (r) {
                formula += ` + 1d8 [extra]`; total += r.total; rolls = [...rolls, ...r.rolls];
                setRuntimeValue(ps.name, key, getCurrentCombatRound(), ctx.campaignName);
              }
            }
          }
        }

        // Superior Hunter's Prey
        if ((ps.automation?.passives || []).some(p => p.type === 'superior_hunter_prey')) {
          const cs = await getCombatContext(ctx.campaignName);
          if (cs) {
            const atk = cs.creatures?.find(c => c.name === ps.name);
            if (atk?.concentration?.spell === "Hunter's Mark") {
              const key = '_Superior_Hunters_Prey_UsedRound';
              const round = getCurrentCombatRound();
              if (getRuntimeValue(ps.name, key, ctx.campaignName) !== round) {
                const r = rollExpression('1d6');
                if (r) {
                  const primary = getTargetFromAttacker(cs, ps.name)?.name;
                  const targets = cs.creatures?.filter(c => c.name !== primary && c.type === 'npc') || [];
                  if (targets.length > 0) {
                    const st = targets[0];
                    const cs2 = await loadCombatSummary(ctx.campaignName);
                    const app = cs2 ? applyDamageToTarget(cs2, st.name, r.total, ['Force'], ctx.campaignName, null, false, ps.name) : null;
                    addEntry(ctx.campaignName, { type: 'roll', characterName: ps.name, rollType: 'damage', name: "Superior Hunter's Prey", formula: '1d6 [Superior Hunters Prey]', rolls: r.rolls, total: r.total, modifier: 0, damageType: 'Force', targetName: st.name, finalDamage: app?.finalDamage }).catch(() => {});
                    if (app && ctx.setPopupHtml) {
                      ctx.setPopupHtml(prev => ({ ...prev, spreadTargetName: st.name, spreadFinalDamage: app.finalDamage, spreadTargetCurrentHp: app.newHp, spreadTargetMaxHp: st.type === 'player' ? (getRuntimeValue(st.name, 'hitPoints') ?? 0) : st.maxHp }));
                    }
                    setRuntimeValue(ps.name, key, round, ctx.campaignName);
                  }
                }
              }
            }
          }
        }

        // Eldritch Strikes (attack_rider weapon_attack_hit, no damage)
        const eldritch = [...(ps.automation?.actions || []), ...(ps.automation?.passives || [])].filter(
          a => a.type === 'attack_rider' && a.trigger === 'weapon_attack_hit' && !a.damageExpression && a.name !== "Stalker's Flurry"
        );
        for (const rider of eldritch) {
          const key = `_${rider.name.replace(/\s+/g, '_')}_usedRound`;
          const round = getCurrentCombatRound();
          if (rider.oncePerTurn && getRuntimeValue(ps.name, key, ctx.campaignName) === round) continue;
          const cs = await getCombatContext(ctx.campaignName);
          const t = cs ? getTargetFromAttacker(cs, ps.name) : null;
          if (t?.name && rider.options?.length > 0) {
            const effs = getRuntimeValue(ctx.campaignName, 'targetEffects') || [];
            setRuntimeValue(ctx.campaignName, 'targetEffects', [...effs, { target: t.name, source: rider.name, option: rider.options[0].name, effect: rider.options[0].effect, value: rider.options[0].value || null, noOpportunityAttacks: rider.options[0].noOpportunityAttacks || false, duration: 'until_start_of_next_turn' }], ctx.campaignName);
            if (rider.oncePerTurn) setRuntimeValue(ps.name, key, round, ctx.campaignName);
            await addEntry(ctx.campaignName, { type: 'ability_use', characterName: ps.name, abilityName: rider.name, description: `${ps.name} used ${rider.name} on ${t.name}, imposing Disadvantage on the target's next saving throw.`, targetName: t.name }).catch(() => {});
          }
        }

        // Stalker's Flurry
        const sf = (ps.automation?.passives || []).find(
          a => a.type === 'attack_rider' && a.trigger === 'weapon_attack_hit' && a.chooseOne && a.options?.length > 0 && a.name === "Stalker's Flurry"
        );
        if (sf) {
          const key = `_${sf.name.replace(/\s+/g, '_')}_usedRound`;
          const round = getCurrentCombatRound();
          if (!sf.oncePerTurn || getRuntimeValue(ps.name, key, ctx.campaignName) !== round) {
            const cs = await getCombatContext(ctx.campaignName);
            const t = cs ? getTargetFromAttacker(cs, ps.name) : null;
            if (t?.name) {
              const optKey = `_${sf.name.replace(/\s+/g, '_')}_option`;
              const chosen = getRuntimeValue(ps.name, optKey, ctx.campaignName);
              if (!chosen) {
                ctx.setAttackRiderModal?.({ action: sf, playerStats: ps, campaignName: ctx.campaignName, targetName: t.name });
                return {
                  modal: { type: 'stalkersFlurry', props: { action: sf, playerStats: ps, campaignName: ctx.campaignName, targetName: t.name } },
                };
              }
              const opt = sf.options.find(o => o.name === chosen);
              if (opt) {
                if (opt.effect === 'sudden_strike') setRuntimeValue(ps.name, 'pendingSuddenStrike', true, ctx.campaignName);
                else if (opt.effect === 'mass_fear') {
                  const effs = getRuntimeValue(ctx.campaignName, 'targetEffects') || [];
                  setRuntimeValue(ctx.campaignName, 'targetEffects', [...effs, { target: t.name, source: sf.name, option: opt.name, effect: 'mass_fear', saveType: opt.saveType || 'WIS', saveDc: opt.saveDc || 'ability', saveAbility: opt.saveAbility || 'WIS', condition: opt.condition || 'frightened', duration: opt.duration || 'until_start_of_next_turn', range: opt.range || '10_ft' }], ctx.campaignName);
                }
              }
              if (sf.oncePerTurn) setRuntimeValue(ps.name, key, round, ctx.campaignName);
            }
          }
        }

        // Crusher feat
        const isBludgeoning = (ctx.attack?.damageType || '').toLowerCase() === 'bludgeoning';
        const crusher = (ps.automation?.passives || []).find(a => a.type === 'attack_rider' && a.trigger === 'bludgeoning_damage_hit' && a.oncePerTurn);
        if (crusher && isBludgeoning) {
          const key = `_${crusher.name.replace(/\s+/g, '_')}_usedRound`;
          const round = getCurrentCombatRound();
          if (getRuntimeValue(ps.name, key, ctx.campaignName) !== round) {
            const cs = await getCombatContext(ctx.campaignName);
            const t = cs ? getTargetFromAttacker(cs, ps.name) : null;
            if (t?.name && crusher.options?.length > 0) {
              const effs = getRuntimeValue(ctx.campaignName, 'targetEffects') || [];
              setRuntimeValue(ctx.campaignName, 'targetEffects', [...effs, { target: t.name, source: crusher.name, option: crusher.options[0].name, effect: crusher.options[0].effect, value: crusher.options[0].value || null, sizeLimit: crusher.options[0].sizeLimit || null, noOpportunityAttacks: crusher.options[0].noOpportunityAttacks || false, duration: 'until_start_of_next_turn' }], ctx.campaignName);
              setRuntimeValue(ps.name, key, round, ctx.campaignName);
            }
          }
        }
        if (isBludgeoning && ctx.isCrit && ps.automation?.passives) {
          const cc = ps.automation.passives.find(a => a.type === 'conditional_advantage' && a.trigger === 'critical_hit_bludgeoning');
          if (cc) {
            const cs = await getCombatContext(ctx.campaignName);
            const t = cs ? getTargetFromAttacker(cs, ps.name) : null;
            if (t?.name) {
              const effs = getRuntimeValue(ctx.campaignName, 'targetEffects') || [];
              setRuntimeValue(ctx.campaignName, 'targetEffects', [...effs, { target: t.name, source: cc.name, effect: 'crusher_enhanced_critical', duration: 'until_start_of_next_turn' }], ctx.campaignName);
            }
          }
        }

        // Slasher feat
        const isSlashing = (ctx.attack?.damageType || '').toLowerCase() === 'slashing';
        const slasher = (ps.automation?.passives || []).find(a => a.type === 'attack_rider' && a.trigger === 'slashing_damage_hit' && a.oncePerTurn);
        if (slasher && isSlashing) {
          const key = `_${slasher.name.replace(/\s+/g, '_')}_usedRound`;
          const round = getCurrentCombatRound();
          if (getRuntimeValue(ps.name, key, ctx.campaignName) !== round) {
            const cs = await getCombatContext(ctx.campaignName);
            const t = cs ? getTargetFromAttacker(cs, ps.name) : null;
            if (t?.name && slasher.options?.length > 0) {
              const effs = getRuntimeValue(ctx.campaignName, 'targetEffects') || [];
              setRuntimeValue(ctx.campaignName, 'targetEffects', [...effs, { target: t.name, source: slasher.name, option: slasher.options[0].name, effect: slasher.options[0].effect, value: slasher.options[0].value || 10, duration: 'until_start_of_next_turn' }], ctx.campaignName);
              setRuntimeValue(ps.name, key, round, ctx.campaignName);
            }
          }
        }
        if (isSlashing && ctx.isCrit && ps.automation?.passives) {
          const sc = ps.automation.passives.find(a => a.type === 'conditional_advantage' && a.trigger === 'critical_hit_slashing');
          if (sc) {
            const cs = await getCombatContext(ctx.campaignName);
            const t = cs ? getTargetFromAttacker(cs, ps.name) : null;
            if (t?.name) {
              const effs = getRuntimeValue(ctx.campaignName, 'targetEffects') || [];
              setRuntimeValue(ctx.campaignName, 'targetEffects', [...effs, { target: t.name, source: sc.name, effect: 'disadvantage_next_attack', duration: 'until_start_of_next_turn' }], ctx.campaignName);
            }
          }
        }

        // Piercer feat
        const isPiercing = (ctx.attack?.damageType || '').toLowerCase() === 'piercing';
        const piercer = (ps.automation?.passives || []).find(a => a.type === 'attack_rider' && a.trigger === 'piercing_damage_hit' && a.oncePerTurn);
        if (piercer && isPiercing) {
          const key = `_${piercer.name.replace(/\s+/g, '_')}_usedRound`;
          const round = getCurrentCombatRound();
          if (getRuntimeValue(ps.name, key, ctx.campaignName) !== round) {
            const cnt = piercer.rerollCount || 1;
            for (let i = 0; i < Math.min(cnt, rolls.length); i++) {
              if (rolls.length > 0) {
                let maxIdx = 0;
                for (let j = 1; j < rolls.length; j++) { if (rolls[j] > rolls[maxIdx]) maxIdx = j; }
                const orig = rolls[maxIdx];
                const rv = Math.floor(Math.random() * 6) + 1;
                rolls[maxIdx] = rv;
                total += rv - orig;
              }
            }
            formula += ' [Piercer Reroll]';
            setRuntimeValue(ps.name, key, round, ctx.campaignName);
          }
        }
        if (isPiercing && ctx.isCrit && ctx.attack?.damage && ps.automation?.passives) {
          const pc = ps.automation.passives.find(a => a.type === 'damage_bonus' && a.trigger === 'critical_hit_piercing');
          if (pc) {
            const m = ctx.attack.damage.match(/(\d+)d(\d+)/);
            if (m) {
              const ds = parseInt(m[2], 10);
              const ev = Math.floor(Math.random() * ds) + 1;
              formula += ` + 1 [${ctx.attack.damageType}]`;
              total += ev;
              rolls = [...rolls, ev];
            }
          }
        }

        // Savage Attacker
        const sa = (ps.automation?.passives || []).find(p => p.type === 'passive_rule' && p.effect === 'reroll_damage_once_per_turn');
        if (sa && ctx.attack?.damage) {
          const key = `_${sa.name?.replace(/\s+/g, '_') || 'SavageAttacker'}_usedRound`;
          const round = getCurrentCombatRound();
          if (getRuntimeValue(ps.name, key, ctx.campaignName) !== round) {
            const m = ctx.attack.damage.match(/(\d+)d(\d+)/);
            if (m && rolls.length > 0) {
              const num = parseInt(m[1], 10);
              const ds = parseInt(m[2], 10);
              if (num > 0 && ds > 0 && num === rolls.length) {
                const first = rolls.reduce((s, r) => s + r, 0);
                const second = [];
                for (let i = 0; i < num; i++) second.push(Math.floor(Math.random() * ds) + 1);
                const secondTotal = second.reduce((s, r) => s + r, 0);
                if (secondTotal > first) {
                  total += secondTotal - first;
                  rolls = second;
                  formula += ' [Savage Attacker]';
                }
                setRuntimeValue(ps.name, key, round, ctx.campaignName);
              }
            }
          }
        }

        // Tavern Brawler reroll ones
        if (ctx.attack?.weaponType === 'unarmed' && ctx.attack?.damage) {
          const tb = (ps.automation?.passives || []).find(p => p.effect === 'tavern_brawler_reroll_ones');
          if (tb) {
            const m = ctx.attack.damage.match(/(\d+)d(\d+)/);
            if (m && rolls.length > 0) {
              const ds = parseInt(m[2], 10);
              let rerolled = false;
              for (let i = 0; i < rolls.length; i++) {
                if (rolls[i] === 1) {
                  const rv = Math.floor(Math.random() * ds) + 1;
                  total += rv - 1;
                  rolls[i] = rv;
                  rerolled = true;
                }
              }
              if (rerolled) formula += ' [Tavern Brawler]';
            }
          }
        }

        // Cantrip bonuses (Potent Spellcasting)
        const isCantrip = ctx.attack?.baseLevel === 0 || ps.spellAbilities?.spells?.some(s => s.name === ctx.attack?.name && s.level === 0);
        if (isCantrip && ps.automation?.actions) {
          const allA = [...(ps.automation.actions || []), ...(ps.automation.passives || [])];
          const upgradedCantrip = new Set(allA.filter(b => b.upgrades).map(b => b.upgrades));
          for (const a of ps.automation.actions.filter(x => x.type === 'damage_bonus' && x.options?.length > 0).filter(b => !upgradedCantrip.has(b.name))) {
            const wis = ps.abilities?.find(x => x.name === 'Wisdom');
            const wisMod = Math.max(0, wis?.bonus || 0);
            if (wisMod > 0) { formula += ` + ${wisMod} [Cantrip]`; total += wisMod; }
            const thp = evaluateAutoExpression(a.tempHpExpression, ps);
            if (thp && !isNaN(thp)) {
              const cs = await getCombatContext(ctx.campaignName);
              const allies = cs?.creatures?.filter(c => c.type === 'player' || c.type === 'npc' || c.type === 'monster') || [];
              if (ctx.setSecondaryTargetModal && allies.length > 0) {
                return {
                  data: { _cantripTempHp: thp },
                  modal: { type: 'secondaryTarget', props: { title: 'Improved Blessed Strikes — Potent Spellcasting', targets: allies.map(c => ({ name: c.name, currentHp: c.currentHp, maxHp: c.maxHp, size: c.size, type: c.type })), confirmLabel: 'Grant Temp HP' } },
                };
              } else {
                const e = getRuntimeValue(ps.name, 'tempHp', ctx.campaignName) || 0;
                setRuntimeValue(ps.name, 'tempHp', Math.max(e, thp), ctx.campaignName);
              }
            }
          }
        }

        // Tavern Brawler push
        if (ctx.attack?.weaponType === 'unarmed') {
          const tbPush = (ps.automation?.passives || []).find(p => p.effect === 'tavern_brawler_push');
          if (tbPush) {
            const key = '_Tavern_Brawler_Push_UsedRound';
            const round = getCurrentCombatRound();
            if (getRuntimeValue(ps.name, key, ctx.campaignName) !== round) {
              setRuntimeValue(ps.name, key, round, ctx.campaignName);
              const cs = await getCombatContext(ctx.campaignName);
              const t = cs ? getTargetFromAttacker(cs, ps.name) : null;
              if (t?.name) {
                const effs = getRuntimeValue(ctx.campaignName, 'targetEffects') || [];
                setRuntimeValue(ctx.campaignName, 'targetEffects', [...effs, { target: t.name, source: 'Tavern Brawler', effect: 'push', value: 5, duration: 'until_end_of_turn' }], ctx.campaignName);
              }
            }
          }
        }

        // Sacred Weapon damage type
        if ((ctx.attack?.weaponType === 'melee' || ctx.attack?.weaponType === 'unarmed') && ps.automation?.passives) {
          const sw = (ps.automation.passives || []).find(p => p.name === 'Sacred Weapon' && p.effect === 'sacred_weapon');
          if (sw) {
            const buffs = getRuntimeValue(ps.name, 'activeBuffs', ctx.campaignName) || [];
            const b = buffs.find(x => x.name === 'Sacred Weapon' && x.effect === 'sacred_weapon');
            if (b?.damageTypeChoice) ctx.attack.damageType = b.damageTypeChoice;
          }
        }

        // Remarkable Athlete
        if (ctx.isCrit && (ps.automation?.passives || []).some(p => p.type === 'auto_effect' && p.effect === 'remarkable_athlete_movement')) {
          setRuntimeValue(ps.name, 'remarkableAthleteNoOA', true, ctx.campaignName);
        }

        return { data: { formula, total, rolls } };
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
      emit: 'overchannel:done',
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
      subscribe: 'overchannel:done',
      emit: 'damage:applied',
      condition: (ctx) => ctx.formula != null,
      handler: async (ctx) => {
        ctx.proceedWithDamage(ctx.attack, ctx.formula, ctx.total, ctx.rolls, ctx.modifier);
        return { data: { _done: true } };
      },
    },
  ];
}
