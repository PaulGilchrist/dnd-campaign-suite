import { useRef, useEffect } from 'react';
import useDiceRoll from './useDiceRoll.js';
import { rollD20 } from '../services/diceRoller.js';
import utils from '../services/utils.js';
import storage from '../services/storage.js';
import { getTargetFromAttacker } from '../services/damageUtils.js';
import {
  computeDamageAfterSave,
  rollSaveForCreature,
  applyDamageToTarget,
} from '../services/applyDamage.js';
import { sendSavePrompt, sendSaveResult } from '../services/savePromptService.js';
import { getAffectedCreatures, processAoeNpcs, sendAoePlayerSaves } from '../services/aoeService.js';
import { getRuntimeValue } from '../hooks/useRuntimeState.js';
import { clearAllExpirationEffects } from '../services/expirations.js';
import { loadCombatSummary, getCombatSummary } from '../services/combatData.js';
import { saveLastDamageEvent } from '../hooks/useMetamagic.js';
import { SHOW_DICE_ROLL_DELAY } from '../config/ui-config.js';

function readAoeContext(campaignName) {
  try {
    const stored = localStorage.getItem(`aoeContext-${campaignName}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export default function useLoggedDiceRoll(characterName, campaignName, options = {}) {
  const { popupHtml, setPopupHtml } = useDiceRoll();
  const { autoDamageRoll, characters } = options;
  const autoDamageRollRef = useRef(null);
  autoDamageRollRef.current = autoDamageRoll || null;

  if (!window.__pendingSaves) window.__pendingSaves = {};
  const pendingSaves = window.__pendingSaves;

  if (campaignName && !window.__pendingResultHandlersInstalled) {
    window.__pendingResultHandlersInstalled = true;

    window.addEventListener('save-result', (e) => {
      const pending = window.__pendingSaves[e.detail.promptId];
      if (!pending) return;

      const combatSummary = getCombatSummary();
      const finalDamage = computeDamageAfterSave(
        e.detail.rawDamage, e.detail.success, e.detail.dcSuccess
      );
      const pendingTargetName = pending.targetName;
      let targetMaxHp = 0;
      if (combatSummary) {
        const t = combatSummary.creatures.find(c => c.name === pendingTargetName);
        if (t) targetMaxHp = t.type === 'player' ? (getRuntimeValue(t.name, 'hitPoints') ?? 0) : t.maxHp;
       }
      const applyResult = applyDamageToTarget(
        combatSummary, pendingTargetName, finalDamage, [pending.damageType], pending.campaignName, null
         );

      logEntry({
        type: 'roll',
        characterName: pending.attackerName || characterName,
        rollType: 'save-damage',
        name: pending.name,
        formula: pending.formula,
        rolls: pending.rolls,
        total: pending.rawDamage,
        modifier: pending.modifier,
        damageType: pending.damageType,
        targetName: e.detail.targetName,
        saveType: e.detail.saveType,
        saveDc: e.detail.saveDc,
        dcSuccess: e.detail.dcSuccess,
        saveResult: e.detail.success ? 'success' : 'failure',
        saveRoll: e.detail.roll,
        saveBonus: e.detail.saveBonus,
        saveRawRolls: e.detail.rawRolls,
        mode: pending.metamagicHeighten ? 'disadvantage' : 'normal',
        bonusDetail: e.detail.bonusDetail,
        finalDamage: applyResult?.finalDamage ?? finalDamage,
        isAoe: pending.isAoe || false,
        aoeAffectedCount: pending.isAoe ? (e.detail.aoeAffectedCount || null) : null,
      });

      delete window.__pendingSaves[e.detail.promptId];

      pending.setPopupHtml({
        type: 'save-damage',
        name: pending.name,
        formula: pending.formula,
        rolls: pending.rolls,
        bonus: 0,
        modifier: pending.modifier,
        damageType: pending.damageType,
        targetName: e.detail.targetName,
        targetCurrentHp: applyResult?.newHp,
        targetMaxHp,
        saveDc: e.detail.saveDc,
        saveType: e.detail.saveType,
        dcSuccess: e.detail.dcSuccess,
        saveResult: { roll: e.detail.roll, total: e.detail.total, bonus: e.detail.saveBonus, success: e.detail.success },
        finalDamage: applyResult?.finalDamage,
        damageApplied: true,
        damageReduced: applyResult?.damageReduced,
      });
    });

    window.addEventListener('death-save-result', (e) => {
      logEntry({
        type: 'death_save',
        characterName: e.detail.targetName,
        roll: e.detail.roll,
        isNatural20: e.detail.isNat20,
        isNatural1: e.detail.isNat1,
        success: e.detail.success,
      });
    });

    window.addEventListener('concentration-result', (e) => {
      logEntry({
        type: 'roll',
        characterName: e.detail.targetName,
        rollType: 'concentration-save',
        name: 'Constitution',
        rolls: [e.detail.roll],
        mode: 'normal',
        total: e.detail.total,
        bonus: e.detail.saveBonus,
        bonusDetail: e.detail.bonusDetail,
        condition: `Concentration: ${e.detail.spellName}`,
        dc: e.detail.dc,
        success: e.detail.success,
        timestamp: Date.now(),
        id: utils.guid(),
      });

      const combatSummary = getCombatSummary();
      if (combatSummary) {
        const creature = combatSummary.creatures.find(c =>
          c.name === e.detail.targetName || c.name.startsWith(e.detail.targetName + ' ')
        );
        if (creature && !e.detail.success) {
          creature.concentration = null;
          storage.set('combatSummary', combatSummary, campaignName);
          window.dispatchEvent(new CustomEvent('combat-summary-updated'));
        }
      }
    });
  }

  useEffect(() => {
    if (popupHtml?.hit === true && popupHtml?.autoDamage && autoDamageRollRef.current) {
      const timer = setTimeout(() => {
        const { autoDamage } = popupHtml;
        autoDamageRollRef.current(autoDamage, popupHtml.isCrit);
      }, SHOW_DICE_ROLL_DELAY);
      return () => clearTimeout(timer);
    }
  }, [popupHtml]);

  function logEntry(entry) {
    fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(entry)
      }).catch(() => {});
   }

    async function logAndShow(name, bonus, rollType, context) {
     const r1 = rollD20();
     const r2 = rollD20();

     const combatSummary = await loadCombatSummary(campaignName);

     const target = combatSummary ? getTargetFromAttacker(combatSummary, utils.getName(characterName)) : null;

     const isAutoMiss = context?.isAutoMiss === true;

      const coverAcBonus = context?.coverAcBonus || 0;

      // Resolve AC: for NPCs, read from the combatSummary creature (stored at encounter setup).
      // For players, the combatSummary creature does NOT store AC — single source of truth is
      // character.computedStats.armorClass, resolved here at read time.
      let targetAc;
      if (target?.type === 'player') {
        const playerChar = (characters || []).find(c => c.name === target.name);
        const playerComputed = playerChar?.computedStats || playerChar;
        targetAc = playerComputed?.armorClass;
      } else {
        targetAc = target?.ac;
      }

      if (target && typeof targetAc !== 'number') {
        throw new Error(`[AC] Target "${target.name}" has no AC defined.`);
      }

      const effectiveAc = target ? targetAc + coverAcBonus : undefined;
      const hit = isAutoMiss ? false : (target ? (r1 + bonus >= effectiveAc) : undefined);
      const targetName = target?.name || context?.targetName;

      const isCrit = !isAutoMiss && (r1 === 20 || context?.isAutoCrit) && hit;

      const autoDamage = hit && context?.autoDamageFormula ? {
        name: context.autoDamageName || name,
        formula: context.autoDamageFormula,
        damageType: context.damageType,
        targetName: targetName,
        attackerName: context.attackerName || characterName,
        saveDc: context.saveDc,
        saveType: context.saveType,
        dcSuccess: context.dcSuccess,
        metamagicTwinTarget: context.metamagicTwinTarget,
        metamagicHeighten: context.metamagicHeighten,
       } : undefined;

     logEntry({
        type: 'roll',
        characterName,
        rollType,
        name,
        rolls: [r1, r2],
       mode: 'normal',
      total: r1,
        bonus,
        isNatural20: r1 === 20,
         isNatural1: r1 === 1,
         targetName,
         targetAc,
          damageType: context?.damageType,
          hit,
          isAutoMiss,
           rangeReason: context?.rangeReason,
           resistanceNotice: context?.resistanceNotice,
           coverLevel: context?.coverLevel,
           coverAcBonus: context?.coverAcBonus,
           coverReason: context?.coverReason,
              });
      setPopupHtml({
         type: 'd20',
         rollType,
         name,
         rolls: [r1, r2],
         bonus,
         targetName,
         targetAc,
         hit,
         isAutoMiss,
         rangeReason: context?.rangeReason,
         resistanceNotice: context?.resistanceNotice,
         coverLevel: context?.coverLevel,
         coverAcBonus: context?.coverAcBonus,
         coverReason: context?.coverReason,
        forcedMode: context?.forcedMode,
        isAutoCrit: context?.isAutoCrit,
        isCrit,
        autoDamage,
      });

    if (rollType === 'initiative') {
        const firstName = utils.getName(characterName);
        const combatSummary = await loadCombatSummary(campaignName);
        if (combatSummary) {
            const creature = combatSummary.creatures.find(
                c => c.type === 'player' && c.name === firstName
              );
            if (creature) {
                creature.initiative = String(r1 + bonus);
                combatSummary.creatures.sort((a, b) => b.initiative - a.initiative);
                storage.set('combatSummary', combatSummary, campaignName);
              }
          }
         clearAllExpirationEffects(characterName, campaignName);
         window.dispatchEvent(new CustomEvent('initiative-rolled', { detail: { characterName: firstName, roll: r1 + bonus } }));
        }
     }

   async function logDamageAndShow(name, formula, total, rolls, modifier, context) {
      const { saveDc, saveType, dcSuccess, damageType, attackerName, isAutoMiss, rangeReason } = context || {};
      const combatSummary = await loadCombatSummary(campaignName);

      if (isAutoMiss) {
        logEntry({
          type: 'roll',
          characterName,
          rollType: 'auto-miss-damage',
          name,
          formula,
          rolls,
          total,
          modifier,
          damageType,
          targetName: context?.targetName,
          rangeReason,
         });
        setPopupHtml({
          type: 'auto-miss',
          name,
          formula,
          rolls,
          bonus: 0,
          modifier,
          damageType,
          targetName: context?.targetName,
          rangeReason,
         });
        return;
       }

       const targetTargetName = context?.targetName;
       if (targetTargetName && targetTargetName.startsWith('overlay-')) {
        const aoeCtx = readAoeContext(campaignName);
        if (aoeCtx && combatSummary) {
          const { overlay, players, npcs } = aoeCtx;
          const affected = getAffectedCreatures(overlay, players, npcs, combatSummary);
          const npcResults = saveDc && saveType
             ? processAoeNpcs(combatSummary, affected, total, damageType, saveDc, saveType, dcSuccess, campaignName)
             : affected.map(({ creature }) => {
                const applyResult = applyDamageToTarget(combatSummary, creature.name, total, [damageType], campaignName, null);
                return { creatureName: creature.name, finalDamage: applyResult?.finalDamage, newHp: applyResult?.newHp, damageReduced: applyResult?.damageReduced, saveSuccess: null };
               });
          const playerAffected = affected.filter(a => a.creature.type === 'player');
          if (playerAffected.length && saveDc && saveType) {
            const playerPrompts = sendAoePlayerSaves(playerAffected, total, damageType, saveDc, saveType, dcSuccess, campaignName, name, attackerName || characterName, rolls, formula);
            for (const pp of playerPrompts) {
              pendingSaves[pp.promptId] = {
                targetName: pp.targetName, rawDamage: total, saveDc, saveType, dcSuccess,
                damageType, attackerName: attackerName || characterName,
                name, formula, modifier, rolls, campaignName, setPopupHtml, isAoe: true,
               };
              }
            }
          const overlayLabel = overlay.label || overlay.shape || 'AoE';
          const npcResultRows = npcResults.map(r => {
            const saveInfo = r.saveSuccess === null ? '' : (r.saveSuccess
               ? `<span class="aoe-save-success">SAVE ${r.saveRoll}+${r.saveBonus} PASS</span>`
               : `<span class="aoe-save-fail">SAVE ${r.saveRoll}+${r.saveBonus} FAIL</span>`);
            const reduced = r.damageReduced ? ' <em>(reduced)</em>' : '';
            return `<div class="aoe-result-row"><strong>${r.creatureName}</strong>: ${r.finalDamage} dmg${reduced} → ${r.newHp !== undefined ? `HP ${r.newHp}` : ''} ${saveInfo}</div>`;
           }).join('');
          const pendingList = playerAffected.length
             ? `<div class="aoe-pending"><i class="fa-solid fa-spinner fa-spin"></i> Waiting for saves: ${playerAffected.map(a => a.creature.name).join(', ')}</div>`
             : '';
          const html = `<div class="aoe-summary"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> ${overlayLabel} — ${name}</h3><div class="aoe-damage-info">${formula}: <strong>${total}</strong> ${damageType || 'untyped'}${saveDc ? ` — ${saveType ? saveType.toUpperCase() : ''} save DC ${saveDc}` : ''}</div><div class="aoe-results">${npcResultRows || '<em>No creatures affected</em>'}</div>${pendingList}</div>`;
          logEntry({
            type: 'aoe-damage',
            characterName,
            rollType: 'aoe-damage',
            name,
            formula, rolls, total, modifier, damageType,
            targetName: overlayLabel,
            affectedCount: affected.length,
            npcResults: npcResults.map(r => r.creatureName),
            saveType, saveDc, dcSuccess,
           });
          setPopupHtml(html);
         }
        return;
       }

      const target = combatSummary?.creatures?.find(c => c.name === context?.targetName) || null;
      const targetMaxHp = target?.type === 'player'
        ? (getRuntimeValue(target.name, 'hitPoints') ?? 0)
        : target?.maxHp ?? 0;

      if (saveDc && saveType && target) {
        if (target.type === 'npc') {
          const disadvantage = context?.metamagicHeighten || false;
          const saveResult = rollSaveForCreature(target, saveType, saveDc, disadvantage);
          const finalDamage = computeDamageAfterSave(total, saveResult.success, dcSuccess);
          const applyResult = applyDamageToTarget(combatSummary, target.name, finalDamage, [damageType], campaignName, null);

          logEntry({
            type: 'roll',
            characterName,
            rollType: 'save-damage',
            name,
            formula,
            rolls,
            total,
            modifier,
            damageType,
            targetName: target.name,
            saveType,
            saveDc,
            saveResult: saveResult.success ? 'success' : 'failure',
            saveRoll: saveResult.roll,
            saveBonus: saveResult.bonus,
            saveRawRolls: saveResult.rawRolls,
            mode: disadvantage ? 'disadvantage' : 'normal',
            finalDamage: applyResult?.finalDamage ?? total,
           });

          setPopupHtml({
            type: 'save-damage',
            name,
            formula,
            rolls,
            bonus: 0,
            modifier,
            damageType,
            targetName: target.name,
            targetCurrentHp: applyResult?.newHp,
            targetMaxHp,
            saveDc,
            saveType,
            dcSuccess,
            saveResult,
            finalDamage: applyResult?.finalDamage,
            damageApplied: true,
            damageReduced: applyResult?.damageReduced,
           });

          if (context?.metamagicHeighten || context?.metamagicCareful || context?.metamagicTwinTarget) {
            saveLastDamageEvent(characterName, {
              targetName: target.name,
              spellName: name,
              damageFormula: formula,
              rawDamage: total,
              damageType,
              saveDc,
              saveType,
              saveResult: saveResult.success ? 'success' : 'failure',
              context,
              rolls,
              modifier,
              timestamp: Date.now(),
            }, campaignName);
          }

          if (context?.metamagicTwinTarget) {
            const twinTarget = combatSummary?.creatures?.find(c => c.name === context.metamagicTwinTarget);
            if (twinTarget && twinTarget.name !== target.name) {
              const twinDisadvantage = context?.metamagicHeighten || false;
              const twinSaveResult = rollSaveForCreature(twinTarget, saveType, saveDc, twinDisadvantage);
              const twinFinalDamage = computeDamageAfterSave(total, twinSaveResult.success, dcSuccess);
              const twinApplyResult = applyDamageToTarget(combatSummary, twinTarget.name, twinFinalDamage, [damageType], campaignName, null);
              logEntry({
                type: 'roll',
                characterName,
                rollType: 'save-damage',
                name: `${name} (Twinned)`,
                formula,
                rolls,
                total,
                modifier,
                damageType,
                targetName: twinTarget.name,
                saveType,
                saveDc,
                saveResult: twinSaveResult.success ? 'success' : 'failure',
                saveRoll: twinSaveResult.roll,
                saveBonus: twinSaveResult.bonus,
                saveRawRolls: twinSaveResult.rawRolls,
                mode: twinDisadvantage ? 'disadvantage' : 'normal',
                finalDamage: twinApplyResult?.finalDamage ?? total,
              });
              setPopupHtml(prev => ({
                ...prev,
                twinTargetName: twinTarget.name,
                twinFinalDamage: twinApplyResult?.finalDamage,
                twinTargetCurrentHp: twinApplyResult?.newHp,
                 twinTargetMaxHp: twinTarget.type === 'npc'
                   ? twinTarget.maxHp
                   : (getRuntimeValue(twinTarget.name, 'hitPoints') ?? 0),
               }));
            }
          }
          return;
          }

        if (target.type === 'player') {
          const isCarefulAlly = context?.metamagicCareful || false;
          if (isCarefulAlly) {
            const carefulDamage = computeDamageAfterSave(total, true, dcSuccess);
            const applyResult = applyDamageToTarget(combatSummary, target.name, carefulDamage, [damageType], campaignName, null);
            logEntry({
              type: 'roll',
              characterName,
              rollType: 'save-damage',
              name,
              formula,
              rolls,
              total,
              modifier,
              damageType,
              targetName: target.name,
              saveType,
              saveDc,
              saveResult: 'success',
              saveRoll: 20,
              saveBonus: 0,
              finalDamage: carefulDamage,
              note: 'Careful Spell: ally automatically succeeds save',
            });
            saveLastDamageEvent(characterName, {
              targetName: target.name,
              spellName: name,
              damageFormula: formula,
              rawDamage: total,
              damageType,
              saveDc,
              saveType,
              saveResult: 'success',
              carefulSpell: true,
              context,
              rolls,
              modifier,
              timestamp: Date.now(),
            }, campaignName);
            setPopupHtml({
              type: 'save-damage',
              name,
              formula,
              rolls,
              bonus: 0,
              modifier,
              damageType,
              targetName: target.name,
              targetCurrentHp: applyResult?.newHp,
              targetMaxHp,
              saveDc,
              saveType,
              dcSuccess,
              saveResult: { success: true, roll: 20, total: saveDc, bonus: 0 },
              finalDamage: carefulDamage,
              damageApplied: true,
              damageReduced: false,
              carefulSpell: true,
            });
            return;
          }
          const promptId = utils.guid();
          pendingSaves[promptId] = {
            targetName: target.name, rawDamage: total, saveDc, saveType, dcSuccess,
            damageType, attackerName: attackerName || characterName, name, formula, modifier, rolls, campaignName, setPopupHtml,
            metamagicHeighten: context?.metamagicHeighten || false,
           };

          sendSavePrompt(campaignName, {
            promptId,
            targetName: target.name,
            saveType,
            saveDc,
            dcSuccess,
            damageFormula: formula,
            damageType,
            sourceName: name,
            sourceAttackerName: attackerName || characterName,
            rawDamage: total,
            disadvantage: context?.metamagicHeighten || false,
           });

          logEntry({
            type: 'roll',
            characterName,
            rollType: 'save-prompt',
            name,
            formula,
            rolls,
            total,
            modifier,
            bonus: modifier,
            damageType,
            targetName: target.name,
            saveType,
            saveDc,
            dcSuccess,
            mode: context?.metamagicHeighten ? 'disadvantage' : 'normal',
           });

          setPopupHtml({
            type: 'save-damage',
            name,
            formula,
            rolls,
            bonus: 0,
            modifier,
            damageType,
            targetName: target.name,
            saveDc,
            saveType,
            dcSuccess,
            waitingForPlayerSave: true,
            promptId,
            rawDamage: total,
            attackerName: attackerName || characterName,
           });
          return;
          }
        }

      let applyResult = null;
      if (target) {
        applyResult = applyDamageToTarget(combatSummary, target.name, total, [damageType], campaignName, null);
       }

     logEntry({
        type: 'roll',
          characterName,
           rollType: 'damage',
             name,
              formula,
               rolls,
                total,
                 modifier,
                 damageType,
                 targetName: target?.name,
                 finalDamage: applyResult?.finalDamage,
               });

       const popupData = {
         type: 'damage',
         name,
         formula,
         rolls,
         bonus: 0,
         modifier,
         dc: context?.dc,
         dcType: context?.dcType,
         dcSuccess: context?.dcSuccess,
         damageType,
         targetName: target?.name,
       };

       if (applyResult) {
          popupData.targetCurrentHp = applyResult.newHp;
          popupData.targetMaxHp = targetMaxHp;
          popupData.damageApplied = true;
         popupData.finalDamage = applyResult.finalDamage;
         popupData.damageReduced = applyResult.damageReduced;
       }

        setPopupHtml(popupData);

      if (context?.metamagicTwinTarget && target) {
        const twinTarget = combatSummary?.creatures?.find(c => c.name === context.metamagicTwinTarget);
        if (twinTarget && twinTarget.name !== target.name) {
          const twinApplyResult = applyDamageToTarget(combatSummary, twinTarget.name, total, [damageType], campaignName, null);
          logEntry({
            type: 'roll',
            characterName,
            rollType: 'damage',
            name: `${name} (Twinned)`,
            formula,
            rolls,
            total,
            modifier,
            damageType,
            targetName: twinTarget.name,
            finalDamage: twinApplyResult?.finalDamage,
          });
          setPopupHtml(prev => ({
            ...prev,
            twinTargetName: twinTarget.name,
            twinFinalDamage: twinApplyResult?.finalDamage,
            twinTargetCurrentHp: twinApplyResult?.newHp,
            twinTargetMaxHp: twinTarget.type === 'player'
            ? (getRuntimeValue(twinTarget.name, 'hitPoints') ?? 0)
            : twinTarget.maxHp,
          }));
        }
      }

        saveLastDamageEvent(characterName, {
          targetName: target?.name,
          spellName: name,
          damageFormula: formula,
          rawDamage: total,
          damageType,
          twinTarget: context?.metamagicTwinTarget || null,
          context,
          rolls,
          modifier,
          timestamp: Date.now(),
        }, campaignName);
        }

  async function quickRollPlayerSave(promptId, targetName, saveType, saveDc) {
    const pending = pendingSaves[promptId];
    if (!pending) return;

    const combatSummary = await loadCombatSummary(campaignName);
    const target = combatSummary?.creatures?.find(c => c.name === pending.targetName);
    if (!target) return;

    const disadvantage = pending.metamagicHeighten || false;
    const saveResult = rollSaveForCreature(target, saveType, saveDc, disadvantage);
    const finalDamage = computeDamageAfterSave(pending.rawDamage, saveResult.success, pending.dcSuccess);
    const applyResult = applyDamageToTarget(combatSummary, pending.targetName, finalDamage, [pending.damageType], campaignName, null);

    delete pendingSaves[promptId];

    sendSaveResult(campaignName, targetName, {
      promptId,
      success: saveResult.success,
      roll: saveResult.roll,
      total: saveResult.total,
      saveBonus: saveResult.bonus,
    });

    saveLastDamageEvent(characterName, {
      targetName: target.name,
      spellName: pending.name,
      damageFormula: pending.formula,
      rawDamage: finalDamage,
      damageType: pending.damageType,
      saveDc,
      saveType,
      saveResult: saveResult.success ? 'success' : 'failure',
      context: pending.context,
      rolls: pending.rolls,
      modifier: pending.modifier,
      timestamp: Date.now(),
    }, campaignName);

    setPopupHtml({
      type: 'save-damage',
      name: pending.name,
      formula: pending.formula,
      rolls: pending.rolls,
      bonus: 0,
      modifier: pending.modifier,
      damageType: pending.damageType,
      targetName: target.name,
      targetCurrentHp: applyResult?.newHp,
      targetMaxHp: target.type === 'player'
        ? (getRuntimeValue(target.name, 'hitPoints') ?? 0)
        : target.maxHp,
      saveDc,
      saveType,
      dcSuccess: pending.dcSuccess,
      saveResult,
      finalDamage: applyResult?.finalDamage,
      damageApplied: true,
      damageReduced: applyResult?.damageReduced,
    });
  }

     return {
           popupHtml,
            setPopupHtml,
        rollAbilityCheck: (name, bonus, context) => logAndShow(name, bonus, 'check', context),
     rollSavingThrow: (name, saveBonus, context) => logAndShow(name, saveBonus, 'save', context),
    rollSkillCheck: (name, bonus, context) => logAndShow(name, bonus, 'skill', context),
    rollInitiative: (initBonus) => logAndShow('Initiative', initBonus, 'initiative'),
       rollAttack: (name, hitBonus, context) => logAndShow(name, hitBonus, 'attack', context),
   rollDamage: (name, formula, total, rolls, modifier, context) => logDamageAndShow(name, formula, total, rolls, modifier, context),
   quickRollPlayerSave,
        };
       }
