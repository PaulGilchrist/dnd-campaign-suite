import { getCombatContext, getTargetFromAttacker } from '../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue, setRuntimeObject } from '../../../hooks/runtime/useRuntimeState.js';
import { getAttackRiderOptions, getAttackRiderOptionsByContext } from '../../automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';
import { sendBardicInspirationOffensePrompt } from '../../combat/prompts/bardicInspirationPromptUtils.js';
import { hasBardicInspirationOffense, getBardicInspirationDieSize } from '../../combat/auras/bardicInspirationState.js';
import { spendResource } from '../../automation/common/resourceCheck.js';
import { addEntry } from '../../ui/logService.js';
import utils from '../../ui/utils.js';

export function buildAttackRiderManeuversStep() {
  return {
    name: 'attackRiderManeuvers',
    subscribe: 'maneuvers:check',
    emit: 'maneuvers:handled',
    condition: (ctx) => !!ctx.setAttackRiderManeuverPrompt,
    handler: async (ctx) => {
      const isHit = ctx.popupHtml?.hit === true || ctx.popupHtml?.isCrit === true;
      const info = {
        weaponType: ctx.attack?.weaponType,
        isUnarmedStrike: ctx.attack?.weaponType === 'unarmed',
        targetName: ctx.targetName,
        hit: isHit,
      };
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
  };
}

function resolveRoundStamp(raw) {
  return raw && typeof raw === 'object' ? raw.round : raw;
}

function findCunningStrikePassive(passives) {
  return passives.find(p => p.name === 'Devious Strikes' && p.type === 'attack_rider') ||
    passives.find(p => p.name === 'Improved Cunning Strike' && p.type === 'attack_rider') ||
    passives.find(p => p.name === 'Cunning Strike' && p.type === 'attack_rider');
}

async function offerCunningStrikeModal(ctx, csPassive, sneakDice) {
  const round = getCurrentCombatRound(ctx.campaignName);
  const usedRound = resolveRoundStamp(getRuntimeValue(ctx.playerStats.name, '_CunningStrike_usedRound', ctx.campaignName));
  const skippedRound = resolveRoundStamp(getRuntimeValue(ctx.playerStats.name, '_cunningStrikeSkippedRound', ctx.campaignName));
  if (usedRound !== round && skippedRound !== round) {
    const cs = await getCombatContext(ctx.campaignName);
    const target = cs ? getTargetFromAttacker(cs, ctx.playerStats.name) : null;
    const modalProps = {
      action: csPassive,
      playerStats: ctx.playerStats,
      campaignName: ctx.campaignName,
      targetName: target?.name || null,
    };
    ctx.setAttackRiderModal?.(modalProps);
    return {
      data: { _cunningStrike: true, sneakDice },
      modal: { type: 'cunningStrike', props: modalProps },
    };
  }
  if (skippedRound === round) {
    setRuntimeValue(ctx.playerStats.name, '_cunningStrikeSkippedRound', null, ctx.campaignName);
  }
  return null;
}

export function buildCunningStrikeStep() {
  return {
    name: 'cunningStrike',
    subscribe: 'maneuvers:handled',
    emit: 'cunning:checked',
    condition: (ctx) => ctx.hit,
    handler: async (ctx) => {
      const lastResult = await getRuntimeValue('campaign', 'lastAttack', ctx.campaignName);
      const attackHit = lastResult?.hit === true || lastResult?.isCrit === true;
      if (!attackHit) return { data: { sneakDice: 0 } };

      const buildFn = ctx.mapName ? ctx.buildCtx : ctx.buildCtxSync;
      // WM-008: damage-phase ctx rebuild — do not consume one-shot attack te.
      const buildResult = buildFn ? await buildFn(ctx.attack, { consumeAttackTe: false }) : null;
      const sneakDice = buildResult?.sneakAttackDice || 0;

      const passives = ctx.playerStats.automation?.passives || [];
      const csPassive = findCunningStrikePassive(passives);
      if (csPassive && sneakDice > 0) {
        const outcome = await offerCunningStrikeModal(ctx, csPassive, sneakDice);
        if (outcome) return outcome;
      }
      return { data: { sneakDice } };
    },
  };
}

export function buildBardicInspirationOffenseStep() {
  return {
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
            }).catch((e) => { console.error("[attackRollRiders:log-error]", e); });
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
  };
}
