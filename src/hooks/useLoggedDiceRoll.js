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

function readAoeContext(campaignName) {
  try {
    const stored = localStorage.getItem(`aoeContext-${campaignName}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function getCombatSummary() {
  const stored = localStorage.getItem('combatSummary');
  if (!stored) return null;
  try { return JSON.parse(stored); } catch { return null; }
}

export default function useLoggedDiceRoll(characterName, campaignName) {
  const { popupHtml, setPopupHtml } = useDiceRoll();

  if (!window.__pendingSaves) window.__pendingSaves = {};
  const pendingSaves = window.__pendingSaves;

  if (campaignName && !window.__saveResultHandlerInstalled) {
    window.__saveResultHandlerInstalled = true;
    window.addEventListener('save-result', (e) => {
      const pending = window.__pendingSaves[e.detail.promptId];
      if (!pending) return;

      const combatSummary = getCombatSummary();
      const finalDamage = computeDamageAfterSave(
        e.detail.rawDamage, e.detail.success, e.detail.dcSuccess
      );
      const targetId = pending.targetId;
      let targetMaxHp = 0;
      if (combatSummary) {
        const t = combatSummary.creatures.find(c => c.id === targetId);
        if (t) targetMaxHp = t.maxHp;
      }
      const applyResult = applyDamageToTarget(
        combatSummary, targetId, finalDamage, [pending.damageType], pending.campaignName
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
  }

  function logEntry(entry) {
    fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(entry)
      }).catch(() => {});
   }

  function logAndShow(name, bonus, rollType, context) {
    const r1 = rollD20();
    const r2 = rollD20();

    const combatSummary = getCombatSummary();

    const target = combatSummary ? getTargetFromAttacker(combatSummary, utils.getName(characterName)) : null;

    const hit = target ? (r1 + bonus >= target.ac) : undefined;
    const targetName = target?.name || context?.targetName;
    const targetAc = target?.ac || context?.targetAc;

    const isCrit = (r1 === 20 || context?.isAutoCrit) && hit;

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
         resistanceNotice: context?.resistanceNotice
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
       resistanceNotice: context?.resistanceNotice,
       forcedMode: context?.forcedMode,
       isAutoCrit: context?.isAutoCrit,
       isCrit
     });

    if (rollType === 'initiative') {
        const firstName = utils.getName(characterName);
        const stored = localStorage.getItem('combatSummary');
        if (stored) {
            try {
                const combatSummary = JSON.parse(stored);
                const creature = combatSummary.creatures.find(
                    c => c.type === 'player' && c.name === firstName
                );
                if (creature) {
                    creature.initiative = String(r1 + bonus);
                    combatSummary.creatures.sort((a, b) => b.initiative - a.initiative);
                    storage.set('combatSummary', combatSummary, campaignName);
                    window.dispatchEvent(new CustomEvent('initiative-rolled'));
                }
            } catch (e) { /* ignore parse errors */ }
        }
    }
     }

   function logDamageAndShow(name, formula, total, rolls, modifier, context) {
      const { saveDc, saveType, dcSuccess, targetId, damageType, attackerName } = context || {};
      const combatSummary = getCombatSummary();

      if (targetId && targetId.startsWith('overlay-')) {
        const aoeCtx = readAoeContext(campaignName);
        if (aoeCtx && combatSummary) {
          const { overlay, players, npcs } = aoeCtx;
          const affected = getAffectedCreatures(overlay, players, npcs, combatSummary);
          const npcResults = saveDc && saveType
            ? processAoeNpcs(combatSummary, affected, total, damageType, saveDc, saveType, dcSuccess, campaignName)
            : affected.map(({ creature }) => {
                const applyResult = applyDamageToTarget(combatSummary, creature.id, total, damageType ? [damageType] : [], campaignName);
                return { creatureName: creature.name, finalDamage: applyResult?.finalDamage, newHp: applyResult?.newHp, damageReduced: applyResult?.damageReduced, saveSuccess: null };
              });
          const playerAffected = affected.filter(a => a.creature.type === 'player');
          if (playerAffected.length && saveDc && saveType) {
            const playerPrompts = sendAoePlayerSaves(playerAffected, total, damageType, saveDc, saveType, dcSuccess, campaignName, name, attackerName || characterName, rolls, formula);
            for (const pp of playerPrompts) {
              pendingSaves[pp.promptId] = {
                targetId: pp.targetId,
                rawDamage: total,
                saveDc,
                saveType,
                dcSuccess,
                damageType,
                attackerName: attackerName || characterName,
                targetName: pp.targetName,
                name,
                formula,
                modifier,
                rolls,
                campaignName,
                setPopupHtml,
                isAoe: true,
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

      const target = targetId ? combatSummary?.creatures?.find(c => c.id === targetId) : null;

     if (saveDc && saveType && target) {
       if (target.type === 'npc') {
         const saveResult = rollSaveForCreature(target, saveType, saveDc);
         const finalDamage = computeDamageAfterSave(total, saveResult.success, dcSuccess);
         const applyResult = applyDamageToTarget(combatSummary, targetId, finalDamage, damageType ? [damageType] : [], campaignName);

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
           targetMaxHp: target.maxHp,
           saveDc,
           saveType,
           dcSuccess,
           saveResult,
           finalDamage: applyResult?.finalDamage,
           damageApplied: true,
           damageReduced: applyResult?.damageReduced,
         });
         return;
       }

       if (target.type === 'player') {
         const promptId = utils.guid();
         pendingSaves[promptId] = {
           targetId, rawDamage: total, saveDc, saveType, dcSuccess,
           damageType, attackerName: attackerName || characterName,
           targetName: target.name, name, formula, modifier, rolls,
           campaignName, setPopupHtml,
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
           damageType,
           targetName: target.name,
           saveType,
           saveDc,
           dcSuccess,
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
           targetId,
           attackerName: attackerName || characterName,
         });
         return;
       }
     }

     let applyResult = null;
     if (target) {
       applyResult = applyDamageToTarget(combatSummary, targetId, total, damageType ? [damageType] : [], campaignName);
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
         popupData.targetMaxHp = target.maxHp;
         popupData.damageApplied = true;
         popupData.finalDamage = applyResult.finalDamage;
         popupData.damageReduced = applyResult.damageReduced;
       }

       setPopupHtml(popupData);
        }

  function quickRollPlayerSave(promptId, targetName, saveType, saveDc) {
    const pending = pendingSaves[promptId];
    if (!pending) return;

    const combatSummary = getCombatSummary();
    const target = combatSummary?.creatures?.find(c => c.id === pending.targetId);
    if (!target) return;

    const saveResult = rollSaveForCreature(target, saveType, saveDc);
    const finalDamage = computeDamageAfterSave(pending.rawDamage, saveResult.success, pending.dcSuccess);
    const applyResult = applyDamageToTarget(combatSummary, pending.targetId, finalDamage, [pending.damageType], campaignName);

    delete pendingSaves[promptId];

    sendSaveResult(campaignName, targetName, {
      promptId,
      success: saveResult.success,
      roll: saveResult.roll,
      total: saveResult.total,
      saveBonus: saveResult.bonus,
    });

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
      targetMaxHp: target.maxHp,
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
        rollAbilityCheck: (name, bonus) => logAndShow(name, bonus, 'check'),
     rollSavingThrow: (name, saveBonus) => logAndShow(name, saveBonus, 'save'),
   rollSkillCheck: (name, bonus) => logAndShow(name, bonus, 'skill'),
    rollInitiative: (initBonus) => logAndShow('Initiative', initBonus, 'initiative'),
       rollAttack: (name, hitBonus, context) => logAndShow(name, hitBonus, 'attack', context),
   rollDamage: (name, formula, total, rolls, modifier, context) => logDamageAndShow(name, formula, total, rolls, modifier, context),
   quickRollPlayerSave,
        };
       }
