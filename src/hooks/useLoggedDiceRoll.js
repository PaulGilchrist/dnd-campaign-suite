import { useRef, useEffect } from 'react';
import useDiceRoll from './useDiceRoll.js';
import { rollD20, rollExpression } from '../services/dice/diceRoller.js';
import utils from '../services/ui/utils.js';
import storage from '../services/ui/storage.js';
import { getTargetFromAttacker } from '../services/rules/combat/damageUtils.js';
import {
  computeDamageAfterSave,
  computeDamageAfterEvasion,
  rollSaveForCreature,
  applyDamageToTarget,
} from '../services/rules/combat/applyDamage.js';
import { sendSavePrompt, sendSaveResult } from '../services/combat/savePromptService.js';
import { getAffectedCreatures, processAoeNpcs, sendAoePlayerSaves } from '../services/rules/combat/aoeService.js';
import { getRuntimeValue, setRuntimeValue } from '../hooks/useRuntimeState.js';
import { clearAllExpirationEffects, addExpiration } from '../services/rules/effects/expirations.js';
import { loadCombatSummary, getCombatSummary } from '../services/encounters/combatData.js';
import { saveLastDamageEvent } from '../hooks/useMetamagic.js';
import { SHOW_DICE_ROLL_DELAY } from '../config/ui-config.js';
import {
    isUnbreakableMajestyActive,
    getUnbreakableMajestySaveDc,
    hasAttackerTriggeredMajesty,
    markAttackerTriggeredMajesty,
} from '../services/combat/unbreakableMajesty.js';
import { MELEE_REACH_FEET } from '../services/combat/baseCombatActions.js';
import { getCombatContext } from '../services/rules/combat/damageUtils.js';
import { hasEmpoweredEvocation, getEmpoweredEvocationIntModifier } from '../services/rules/spells/postCastRiderService.js';
import { playerIsImmuneToCondition, hasIgnoreResistance, hasMinDamage } from '../services/combat/automationService.js';
import { endInvisibilityOnHostileAction } from '../services/rules/features/invisibilityService.js';

function dispatchUnbreakableMajestySave(campaignName, defenderName, attackerName, saveDc, promptId) {
    sendSavePrompt(campaignName, {
        promptId,
        targetName: attackerName,
        saveType: 'CHA',
        saveDc,
        sourceName: defenderName,
    });
}

function readAoeContext(campaignName) {
  try {
    const stored = localStorage.getItem(`aoeContext-${campaignName}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function hasPotentCantrip(playerStats) {
    if (!playerStats) return false;
    const passives = playerStats?.automation?.passives || [];
    return passives.some(p => p.type === 'potent_cantrip');
}

function getShieldAcBonus(characterName, campaignName) {
    const activeBuffs = getRuntimeValue(characterName, 'activeBuffs', campaignName) || [];
    const shieldActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'shield');
    return shieldActive ? 5 : 0;
}

function getShieldOfFaithAcBonus(characterName, campaignName) {
    const activeBuffs = getRuntimeValue(characterName, 'activeBuffs', campaignName) || [];
    const shieldOfFaithActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'shield_of_faith');
    return shieldOfFaithActive ? 2 : 0;
}

function isMagicMissileImmune(characterName, campaignName) {
    const activeBuffs = getRuntimeValue(characterName, 'activeBuffs', campaignName) || [];
    return Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'shield');
}

function getSoulstitchProtectedCreatures(playerName, campaignName) {
    const key = `_${playerName.replace(/\s+/g, '_')}_Soulstitch_Spells_active`;
    const stored = getRuntimeValue(playerName, key, campaignName);
    return Array.isArray(stored) ? stored : [];
}

function hasSoulstitchProtection(targetName, playerName, campaignName) {
    const protectedList = getSoulstitchProtectedCreatures(playerName, campaignName);
    return protectedList.includes(targetName);
}

function applyMinDamageAdjustment(rawDamage, rolls, playerStats, damageType) {
    if (!playerStats || !damageType || !rolls || !Array.isArray(rolls) || rolls.length === 0) {
        return rawDamage;
    }
    const hasMin = hasMinDamage(playerStats, damageType);
    if (!hasMin) return rawDamage;
    const onesCount = rolls.filter(r => r === 1).length;
    if (onesCount === 0) return rawDamage;
    return rawDamage + onesCount;
}

export default function useLoggedDiceRoll(characterName, campaignName, options = {}) {
  const { popupHtml, setPopupHtml } = useDiceRoll();
  const { autoDamageRoll, characters } = options;
  const autoDamageRollRef = useRef(null);
  autoDamageRollRef.current = autoDamageRoll || null;
  const charactersRef = useRef(characters);
  charactersRef.current = characters || [];

  if (!window.__pendingSaves) window.__pendingSaves = {};
  const pendingSaves = window.__pendingSaves;

  if (campaignName && !window.__pendingResultHandlersInstalled) {
    window.__pendingResultHandlersInstalled = true;

    window.addEventListener('save-result', (e) => {
      const pending = window.__pendingSaves[e.detail.promptId];
      if (!pending) return;

      const combatSummary = getCombatSummary();
      const saveTypeUpper = (e.detail.saveType || '').toUpperCase();
      const targetChar = (charactersRef.current || []).find(c => c.name === e.detail.targetName);
      const targetConditions = getRuntimeValue(e.detail.targetName, 'activeConditions', pending.campaignName) || [];
      const isIncapacitated = targetConditions.some(c => String(c).toLowerCase() === 'incapacitated');

      // Soulstitch Spells: chosen creatures auto-succeed and take no damage
      const isSoulstitchProtected = hasSoulstitchProtection(e.detail.targetName, characterName, pending.campaignName);

      // Shield spell: immunity to Magic Missile damage
      const targetActiveBuffs = getRuntimeValue(e.detail.targetName, 'activeBuffs', pending.campaignName) || [];
      const isShieldActive = Array.isArray(targetActiveBuffs) && targetActiveBuffs.some(b => b.effect === 'shield');
      const isMagicMissile = pending.name && pending.name.toLowerCase() === 'magic missile';
      if (isShieldActive && isMagicMissile) {
        finalDamage = 0;
      }

      const ownEvasion = targetChar?.computedStats?.evasionEffects;
      const hasOwnEvasion = !isIncapacitated && pending.dcSuccess === 'half' && ownEvasion?.some(ef => ef.saveType === saveTypeUpper);
      const hasSharedEvasion = !hasOwnEvasion && !isIncapacitated && pending.dcSuccess === 'half' &&
        (charactersRef.current || []).some(c => {
          if (c.name === e.detail.targetName) return false;
          const ev = c?.computedStats?.evasionEffects;
          return ev?.some(ef => ef.saveType === saveTypeUpper && ef.shareable && ef.shareRange >= 5);
        });
      const hasEvasion = hasOwnEvasion || hasSharedEvasion;
      let finalDamage = isSoulstitchProtected ? 0 : computeDamageAfterEvasion(
        e.detail.rawDamage, e.detail.success, e.detail.dcSuccess, hasEvasion
      );

      const interveneShieldActive = getRuntimeValue(e.detail.targetName, 'interveneShieldActive', pending.campaignName);
      if (interveneShieldActive && e.detail.saveType === 'DEX' && e.detail.dcSuccess === 'half') {
          if (e.detail.success) {
              finalDamage = 0;
          }
          setRuntimeValue(e.detail.targetName, 'interveneShieldActive', null, pending.campaignName);
      }
      const pendingTargetName = pending.targetName;
      let targetMaxHp = 0;
      if (combatSummary) {
        const t = combatSummary.creatures.find(c => c.name === pendingTargetName);
        if (t) targetMaxHp = t.type === 'player' ? (getRuntimeValue(t.name, 'hitPoints') ?? 0) : t.maxHp;
       }
        const ignoreResistance = (pending.playerStats && hasIgnoreResistance(pending.playerStats, pending.damageType)) || false;
        const applyResult = applyDamageToTarget(
          combatSummary, pendingTargetName, finalDamage, [pending.damageType], pending.campaignName, null, ignoreResistance, pending.attackerName || characterName
           );

        if (applyResult && applyResult.finalDamage > 0) {
          endInvisibilityOnHostileAction(pending.attackerName || characterName, pending.campaignName);
        }

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
         saveResult: isSoulstitchProtected ? 'soulstitch_auto_success' : (e.detail.success ? 'success' : 'failure'),
         saveRoll: e.detail.roll,
         saveBonus: e.detail.saveBonus,
         saveRawRolls: e.detail.rawRolls,
         mode: pending.metamagicHeighten ? 'disadvantage' : 'normal',
         bonusDetail: e.detail.bonusDetail,
         finalDamage: applyResult?.finalDamage ?? finalDamage,
         isAoe: pending.isAoe || false,
         aoeAffectedCount: pending.isAoe ? (e.detail.aoeAffectedCount || null) : null,
         soulstitchProtected: isSoulstitchProtected,
        });

       // Overchannel self-damage (2nd+ use before Long Rest)
       if (pending.overchannelActive && pending.overchannelUseCount > 1) {
           const overchannelSpellLevel = pending.overchannelSpellLevel || 1;
           const dicePerLevel = 2 + (pending.overchannelUseCount - 1);
           const totalDice = dicePerLevel * overchannelSpellLevel;
           const necroticFormula = `${totalDice}d12`;
           const necroticResult = rollExpression(necroticFormula);
           if (necroticResult) {
               const casterCombatSummary = getCombatSummary();
               const casterApplyResult = applyDamageToTarget(casterCombatSummary, characterName, necroticResult.total, ['Necrotic'], campaignName, null, true, characterName);
               logEntry({
                   type: 'roll',
                   characterName,
                   rollType: 'overchannel-damage',
                   name: 'Overchannel',
                   formula: necroticFormula,
                   rolls: necroticResult.rolls,
                   total: necroticResult.total,
                   modifier: necroticResult.modifier,
                   damageType: 'Necrotic',
                   targetName: characterName,
                   finalDamage: casterApplyResult?.finalDamage,
                   note: 'Overchannel self-damage (ignores resistance/immunity)',
               });
           }
           const usesKey = '_Overchannel_uses';
           const restKey = '_Overchannel_restTimestamp';
           const now = Date.now();
           const lastRestTimestamp = getRuntimeValue(characterName, restKey, campaignName);
           let currentUses;
           if (lastRestTimestamp && now - lastRestTimestamp < 86400000) {
               currentUses = Number(getRuntimeValue(characterName, usesKey, campaignName) ?? 1);
           } else if (!lastRestTimestamp) {
               currentUses = Number(getRuntimeValue(characterName, usesKey, campaignName) ?? 1);
           } else {
               currentUses = 1;
           }
           if (currentUses > 0) {
               setRuntimeValue(characterName, usesKey, currentUses - 1, campaignName);
           }
       }

        delete window.__pendingSaves[e.detail.promptId];

        if (!e.detail.success && pending.statusEffects?.length > 0) {
            const targetName = pending.targetName;
            const targetCreature = combatSummary?.creatures?.find(c => c.name === targetName);
            const targetCharacter = (charactersRef.current || []).find(c => utils.getName(c.name) === targetName);
            const targetStats = targetCharacter?.computedStats || targetCharacter;
            const effectsToExpire = [];
            for (const effect of pending.statusEffects) {
                const condKey = String(effect).toLowerCase();
                const attackerName = pending.attackerName || characterName;
                const attackerCreature = combatSummary?.creatures?.find(c => c.name === attackerName);
                if (targetStats && playerIsImmuneToCondition({
                    conditionKey: condKey,
                    playerStats: targetStats,
                    getRuntimeValue: getRuntimeValue,
                    campaignName: pending.campaignName,
                    sourceCreatureType: attackerCreature?.type,
                })) {
                    continue;
                }
                if (targetCreature?.type === 'player') {
                    const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
                    const filtered = conditions.filter(c => String(c).toLowerCase() !== condKey);
                    setRuntimeValue(targetName, 'activeConditions', [...filtered, condKey], pending.campaignName);
                    effectsToExpire.push({ type: 'condition', condition: condKey });
                } else if (targetCreature) {
                    targetCreature.conditions = (targetCreature.conditions || []).filter(c => c.key !== condKey);
                    targetCreature.conditions.push({
                        id: utils.guid(),
                        key: condKey,
                        label: effect.charAt(0).toUpperCase() + effect.slice(1),
                        dc: pending.saveDc,
                        ability: pending.saveType.toLowerCase(),
                        endsOnDamage: true,
                    });
                    effectsToExpire.push({ type: 'condition', condition: condKey });
                }
            }
            if (effectsToExpire.length > 0) {
                addExpiration(characterName, targetName, effectsToExpire, pending.campaignName, 2);
            }
        }

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
          setRuntimeValue(e.detail.targetName, 'mantleOfMajestyActive', null, campaignName);
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

      const effectiveD20 = (context?.d20Floor10 && r1 <= 9) ? 10 : r1;

      const combatSummary = await loadCombatSummary(campaignName);

      const target = combatSummary ? getTargetFromAttacker(combatSummary, utils.getName(characterName)) : null;

      let isAutoMiss = context?.isAutoMiss === true;

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

        const effectiveAc = target ? targetAc + coverAcBonus + (context?.gloriousDefenseBonus || 0) + (context?.defensiveDuelistBonus || 0) + getShieldAcBonus(characterName, campaignName) + getShieldOfFaithAcBonus(characterName, campaignName) : undefined;
        let hit = isAutoMiss ? false : (target ? (effectiveD20 + bonus >= effectiveAc) : undefined);
       const targetName = target?.name || context?.targetName;
       const attackerName = context?.attackerName || characterName;

       // Unerring Strike (Living Legend): once per turn, missed weapon attacks hit automatically
       if (!hit && !isAutoMiss && rollType === 'attack' && context?.isWeaponAttack) {
           const livingLegendActive = getRuntimeValue(characterName, 'livingLegendActive', campaignName);
           if (livingLegendActive) {
               const unerringStrikeUsed = getRuntimeValue(characterName, 'unerringStrikeUsed', campaignName);
               if (!unerringStrikeUsed) {
                   hit = true;
                   isAutoMiss = false;
                   await setRuntimeValue(characterName, 'unerringStrikeUsed', true, campaignName);
               }
           }
       }

      if (hit && target) {
          const majActive = isUnbreakableMajestyActive(target.name, campaignName);
          if (majActive && !hasAttackerTriggeredMajesty(target.name, attackerName, campaignName)) {
              const majSaveDc = getUnbreakableMajestySaveDc(target.name, campaignName);
              const promptId = `majesty-${utils.guid()}`;
              markAttackerTriggeredMajesty(target.name, attackerName, campaignName);
              dispatchUnbreakableMajestySave(campaignName, target.name, attackerName, majSaveDc, promptId);
              logEntry({
                  type: 'ability_use',
                  characterName: target.name,
                  abilityName: 'Unbreakable Majesty',
                  description: `${target.name}'s Unbreakable Majesty — ${attackerName} must make a CHA save (DC ${majSaveDc}) or the attack misses.`,
              });
              let saveResolved = false;
              await new Promise((resolve) => {
                  const handler = (event) => {
                      if (event.detail.promptId !== promptId) return;
                      window.removeEventListener('save-result', handler);
                      saveResolved = true;
                      if (!event.detail.success) {
                          hit = false;
                          isAutoMiss = true;
                          logEntry({
                              type: 'ability_use',
                              characterName: target.name,
                              abilityName: 'Unbreakable Majesty',
                              description: `${attackerName} failed the CHA save — attack misses due to Unbreakable Majesty!`,
                          });
                      } else {
                          logEntry({
                              type: 'ability_use',
                              characterName: target.name,
                              abilityName: 'Unbreakable Majesty',
                              description: `${attackerName} succeeded on the CHA save — attack hits.`,
                          });
                      }
                      resolve();
                  };
                  window.addEventListener('save-result', handler);
                  setTimeout(() => {
                      if (!saveResolved) {
                          window.removeEventListener('save-result', handler);
                          resolve();
                      }
                  }, 30000);
               });
           }
       }

        // Veer (Mounted Combatant feat): redirect attack from mount to rider
        if (hit && target && rollType === 'attack') {
            const riderName = getRuntimeValue(target.name, 'mountedBy', campaignName);
            if (riderName) {
                const veerActive = getRuntimeValue(riderName, 'veerActive', campaignName);
                if (veerActive) {
                    const mountCreature = combatSummary?.creatures?.find(c => c.name === target.name);
                    const mountNotIncapacitated = mountCreature ? !mountCreature.conditions?.some(c => {
                        const cStr = typeof c === 'object' ? String(c.key || '') : String(c);
                        return ['incapacitated'].includes(cStr.toLowerCase());
                    }) : true;
                    const riderNotIncapacitated = !getRuntimeValue(riderName, 'activeConditions', campaignName)?.some(c => {
                        const cStr = typeof c === 'object' ? String(c.key || '') : String(c);
                        return ['incapacitated'].includes(cStr.toLowerCase());
                    });
                    if (mountNotIncapacitated && riderNotIncapacitated) {
                        logEntry({
                            type: 'ability_use',
                            characterName: riderName,
                            abilityName: 'Veer',
                            description: `${riderName} uses Veer to redirect the attack from ${target.name} to themselves.`,
                        });
                        await setRuntimeValue(riderName, 'veerActive', null, campaignName);
                        hit = false;
                        isAutoMiss = true;
                        let veerResultResolved = false;
                        const redirectResult = await new Promise((resolve) => {
                            const handler = (event) => {
                                if (event.detail.promptId !== `veer-${target.name}`) return;
                                window.removeEventListener('veer-confirm', handler);
                                veerResultResolved = true;
                                resolve(event.detail.confirm);
                            };
                            window.addEventListener('veer-confirm', handler);
                            setTimeout(() => {
                                if (!veerResultResolved) {
                                    window.removeEventListener('veer-confirm', handler);
                                    resolve(true);
                                }
                            }, 15000);
                        });
                        if (redirectResult) {
                            hit = true;
                            isAutoMiss = false;
                            logEntry({
                                type: 'ability_use',
                                characterName: riderName,
                                abilityName: 'Veer',
                                description: `${riderName} redirects the attack — it now hits ${riderName} instead of ${target.name}.`,
                            });
                        } else {
                            logEntry({
                                type: 'ability_use',
                                characterName: riderName,
                                abilityName: 'Veer',
                                description: `${riderName} declined to use Veer. Attack hits ${target.name}.`,
                            });
                        }
                    }
                }
            }
        }

        const criticalRange = context?.criticalRange;
       let rollsInCriticalRange = false;
       if (criticalRange) {
           const match = criticalRange.match(/^(\d+)-(\d+)$/);
           if (match) {
               const low = parseInt(match[1], 10);
               const high = parseInt(match[2], 10);
               rollsInCriticalRange = effectiveD20 >= low && effectiveD20 <= high;
           }
       }
       const isCrit = !isAutoMiss && (r1 === 20 || context?.isAutoCrit || rollsInCriticalRange) && hit;

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
          isCantrip: context.isCantrip,
          overchannelActive: context.overchannelActive,
          overchannelUseCount: context.overchannelUseCount,
          overchannelSpellLevel: context.overchannelSpellLevel,
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
            hunterLoreNotice: context?.hunterLoreNotice,
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
             hunterLoreNotice: context?.hunterLoreNotice,
            coverLevel: context?.coverLevel,
            coverAcBonus: context?.coverAcBonus,
            coverReason: context?.coverReason,
           forcedMode: context?.forcedMode,
           isAutoCrit: context?.isAutoCrit,
           isCrit,
           isNatural20: r1 === 20,
           autoDamage,
            autoReroll: context?.autoReroll,
            autoRerollBonus: context?.autoRerollBonus,
             strSaveReplace: context?.strSaveReplace,
             strScore: context?.strScore,
              strCheckReplace: context?.strCheckReplace,
             reliableTalent: context?.reliableTalent,
               wisCheckReplace: context?.wisCheckReplace,
              wisCheckMinBonus: context?.wisCheckMinBonus,
              gloriousDefenseBonus: context?.gloriousDefenseBonus || 0,
              defensiveDuelistBonus: context?.defensiveDuelistBonus || 0,
              d20Floor10: context?.d20Floor10,
           });

       if (rollType === 'attack') {
           setRuntimeValue(characterName, 'lastAttackRoll', {
               d20: effectiveD20,
               bonus,
              targetName,
              targetAc,
              hit,
              isCrit,
              effectiveAc,
              coverAcBonus,
              timestamp: Date.now(),
          }, campaignName);

           // Soulknife Homing Strikes (level 9+): if Psychic Blade misses, add psionic energy die
           const ps = context?.playerStats;
           const isSoulknife = ps?.class?.name === 'Rogue' && ps?.class?.major?.name === 'Soulknife';
           const hasSoulBlades = isSoulknife && ps?.level >= 9;
           const isPsychicBlade = context?.isPsychicBlade === true;
           if (hasSoulBlades && isPsychicBlade && hit === false && !isAutoMiss) {
               const classLevel = ps?.class?.class_levels?.find(cl => cl.level === ps?.level);
               const psionicDieSize = classLevel?.energy?.energy_die || 6;
               const psionicBonus = Math.floor(Math.random() * psionicDieSize) + 1;
               const newTotal = effectiveD20 + bonus + psionicBonus;
               const newHit = targetAc ? (newTotal >= targetAc) : null;
               if (newHit === true) {
                   // Update the stored attack roll with the homing strike bonus
                   setRuntimeValue(characterName, 'lastAttackRoll', {
                       d20: effectiveD20,
                       bonus: bonus + psionicBonus,
                       targetName,
                       targetAc,
                       hit: true,
                       isCrit: false,
                       effectiveAc,
                       coverAcBonus,
                       timestamp: Date.now(),
                       homingStrikesBonus: psionicBonus,
                   }, campaignName);
               }
           }

             // Potent Cantrip: on miss, deal half damage for cantrips
             const potentPlayerStats = context?.playerStats;
             const hasPotentCantripFlag = hasPotentCantrip(potentPlayerStats);
             if (hasPotentCantripFlag && !hit && !isAutoMiss && autoDamage) {
                 let potentFormula = autoDamage.formula;
                 const hasEmpoweredEvoc = hasEmpoweredEvocation(potentPlayerStats);
                 const empEvocIntMod = hasEmpoweredEvoc ? getEmpoweredEvocationIntModifier(potentPlayerStats) : 0;
                 const spellSchool = (autoDamage.spellSchool || '').toLowerCase();
                 const isEvocation = spellSchool === 'evocation';
                 const shouldApplyEmpoweredEvoc = hasEmpoweredEvoc && isEvocation && empEvocIntMod > 0;
                 if (shouldApplyEmpoweredEvoc) {
                     potentFormula = `${potentFormula} + ${empEvocIntMod}[Empowered Evocation]`;
                 }
                 const damageResult = rollExpression(potentFormula);
                 if (damageResult) {
                     const adjustedPotentTotal = applyMinDamageAdjustment(damageResult.total, damageResult.rolls, context?.playerStats, autoDamage.damageType);
                     const halfDamage = Math.floor(adjustedPotentTotal / 2);
                     const combatSummary2 = await loadCombatSummary(campaignName);
                     const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, autoDamage.damageType)) || false;
                     const applyResult = applyDamageToTarget(combatSummary2, targetName, halfDamage, [autoDamage.damageType], campaignName, null, ignoreResistance, autoDamage.attackerName || characterName);
                    const missTargetMaxHp = target?.type === 'player'
                        ? (getRuntimeValue(target.name, 'hitPoints') ?? 0)
                        : target?.maxHp ?? 0;
                    logEntry({
                        type: 'roll',
                        characterName,
                        rollType: 'cantrip-miss-half-damage',
                        name,
                        formula: potentFormula,
                        rolls: damageResult.rolls,
                        total: halfDamage,
                        modifier: damageResult.modifier,
                        damageType: autoDamage.damageType,
                        targetName: autoDamage.targetName,
                        isPotentCantrip: true,
                    });
                    setPopupHtml({
                        type: 'save-damage',
                        name,
                        formula: potentFormula,
                        rolls: damageResult.rolls,
                        bonus: damageResult.modifier,
                        modifier: damageResult.modifier,
                        damageType: autoDamage.damageType,
                        targetName: autoDamage.targetName,
                        targetCurrentHp: applyResult?.newHp,
                        targetMaxHp: missTargetMaxHp,
                        saveDc: autoDamage.saveDc,
                        saveType: autoDamage.saveType,
                        dcSuccess: 'half',
                        saveResult: { success: true, roll: 1, total: 0, bonus: 0 },
                        finalDamage: applyResult?.finalDamage,
                        damageApplied: true,
                        damageReduced: applyResult?.damageReduced,
                       isPotentCantrip: true,
                   });
               }
           }
       }

       if (rollType === 'check' || rollType === 'skill') {
           const effectiveD20 = context?.reliableTalent && r1 <= 9 ? 10 : r1;
           setRuntimeValue(characterName, 'lastAbilityCheck', {
               d20: effectiveD20,
               bonus,
               checkName: name,
               targetName,
               timestamp: Date.now(),
           }, campaignName);
       }

       if (rollType === 'save') {
           setRuntimeValue(characterName, 'lastSaveRoll', {
               d20: effectiveD20,
               bonus,
               saveType: context?.saveType || null,
               targetName,
               timestamp: Date.now(),
           }, campaignName);
       }

    if (rollType === 'initiative') {
        const firstName = utils.getName(characterName);
        const tandemFtBonus = Number(getRuntimeValue(firstName, 'tandemFootworkBonus', campaignName) ?? 0);
        if (tandemFtBonus > 0) {
            setRuntimeValue(firstName, 'tandemFootworkBonus', 0, campaignName);
        }
        const totalBonus = bonus + tandemFtBonus;
        const combatSummary = await loadCombatSummary(campaignName);
        if (combatSummary) {
            const creature = combatSummary.creatures.find(
                c => c.type === 'player' && c.name === firstName
              );
            if (creature) {
                creature.initiative = String(r1 + totalBonus);
                combatSummary.creatures.sort((a, b) => b.initiative - a.initiative);
                storage.set('combatSummary', combatSummary, campaignName);
              }
          }
          clearAllExpirationEffects(characterName, campaignName);
          setRuntimeValue(characterName, 'uncannyMetabolismUsed', false, campaignName);
          window.dispatchEvent(new CustomEvent('initiative-rolled', { detail: { characterName: firstName, roll: r1 + totalBonus } }));
        }
     }

    async function logDamageAndShow(name, formula, total, rolls, modifier, context) {
        const { saveDc, saveType, dcSuccess, damageType, attackerName, isAutoMiss, rangeReason } = context || {};
        const adjustedTotal = applyMinDamageAdjustment(total, rolls, context?.playerStats, damageType);

        // Shield spell: immunity to Magic Missile damage
        if (isMagicMissileImmune(characterName, campaignName) && name && name.toLowerCase() === 'magic missile') {
            const combatSummary = await loadCombatSummary(campaignName);
            const target = combatSummary?.creatures?.find(c => c.name === context?.targetName) || null;
            const targetMaxHp = target?.type === 'player'
                ? (getRuntimeValue(target.name, 'hitPoints') ?? 0)
                : target?.maxHp ?? 0;
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
                targetName: context?.targetName,
                finalDamage: 0,
                note: 'Shield: Immune to Magic Missile',
            });
            setPopupHtml({
                type: 'damage',
                name,
                formula,
                rolls,
                bonus: 0,
                modifier,
                damageType,
                targetName: context?.targetName,
                total,
                adjustedTotal: 0,
                targetCurrentHp: target?.type === 'player' ? (getRuntimeValue(target.name, 'hitPoints') ?? 0) : (target?.currentHp ?? target?.maxHp),
                targetMaxHp,
                damageApplied: true,
                finalDamage: 0,
                damageReduced: true,
                note: 'Shield: Immune to Magic Missile',
            });
            return;
        }

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
               ? processAoeNpcs(combatSummary, affected, adjustedTotal, damageType, saveDc, saveType, dcSuccess, campaignName, attackerName || characterName)
                : affected.map(({ creature }) => {
                   const applyResult = applyDamageToTarget(combatSummary, creature.name, adjustedTotal, [damageType], campaignName, null, false, attackerName || characterName);
                  if (applyResult && applyResult.finalDamage > 0) {
                    endInvisibilityOnHostileAction(attackerName || characterName, campaignName);
                  }
                  return { creatureName: creature.name, finalDamage: applyResult?.finalDamage, newHp: applyResult?.newHp, damageReduced: applyResult?.damageReduced, saveSuccess: null };
                 });
          const playerAffected = affected.filter(a => a.creature.type === 'player');
          const casterName = attackerName || characterName;
          // Filter out soulstitch-protected players from save prompts
          const playersNeedingSave = playerAffected.filter(a => !hasSoulstitchProtection(a.creature.name, casterName, campaignName));
          const soulstitchProtectedPlayers = playerAffected.filter(a => hasSoulstitchProtection(a.creature.name, casterName, campaignName));

          // Process soulstitch-protected players immediately (auto-succeed, no damage)
          for (const pp of soulstitchProtectedPlayers) {
            const creature = pp.creature;
            const applyResult = applyDamageToTarget(combatSummary, creature.name, 0, [damageType], campaignName, null, false, casterName);
            npcResults.push({
              creatureName: creature.name,
              saveSuccess: true,
              saveRoll: null,
              saveBonus: null,
              finalDamage: 0,
              newHp: applyResult?.newHp,
              damageReduced: true,
              soulstitchProtected: true,
            });
          }

          if (playersNeedingSave.length && saveDc && saveType) {
             const playerPrompts = sendAoePlayerSaves(playersNeedingSave, adjustedTotal, damageType, saveDc, saveType, dcSuccess, campaignName, name, casterName, rolls, formula);
            for (const pp of playerPrompts) {
              pendingSaves[pp.promptId] = {
                  targetName: pp.targetName, rawDamage: adjustedTotal, saveDc, saveType, dcSuccess,
                  damageType, attackerName: attackerName || characterName,
                  name, formula, modifier, rolls, campaignName, setPopupHtml, isAoe: true,
                  isCantrip: context?.isCantrip || false,
                  overchannelActive: context?.overchannelActive || false,
                  overchannelUseCount: context?.overchannelUseCount || 0,
                  overchannelSpellLevel: context?.overchannelSpellLevel || 1,
                  playerStats: context?.playerStats,
                 };
              }
            }
          const overlayLabel = overlay.label || overlay.shape || 'AoE';
          const npcResultRows = npcResults.map(r => {
            const soulstitchNote = r.soulstitchProtected ? ' <em>(Soulstitch)</em>' : '';
            const saveInfo = r.saveSuccess === null ? '' : (r.saveSuccess
               ? `<span class="aoe-save-success">SAVE ${r.saveRoll !== null ? r.saveRoll + '+' + r.saveBonus : 'auto'} PASS</span>`
               : `<span class="aoe-save-fail">SAVE ${r.saveRoll}+${r.saveBonus} FAIL</span>`);
            const reduced = r.damageReduced ? ' <em>(reduced)</em>' : '';
            return `<div class="aoe-result-row"><strong>${r.creatureName}</strong>: ${r.finalDamage} dmg${reduced} → ${r.newHp !== undefined ? `HP ${r.newHp}` : ''} ${saveInfo}${soulstitchNote}</div>`;
           }).join('');
          const pendingList = playersNeedingSave.length
             ? `<div class="aoe-pending"><i class="fa-solid fa-spinner fa-spin"></i> Waiting for saves: ${playersNeedingSave.map(a => a.creature.name).join(', ')}</div>`
             : '';
           const displayTotal = adjustedTotal !== total ? `${total} (+${adjustedTotal - total} Elemental Adept)` : String(total);
           const html = `<div class="aoe-summary"><h3><i class="fa-solid fa-wand-magic-sparkles"></i> ${overlayLabel} — ${name}</h3><div class="aoe-damage-info">${formula}: <strong>${displayTotal}</strong> ${damageType || 'untyped'}${saveDc ? ` — ${saveType ? saveType.toUpperCase() : ''} save DC ${saveDc}` : ''}</div><div class="aoe-results">${npcResultRows || '<em>No creatures affected</em>'}</div>${pendingList}</div>`;
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

           // Overchannel self-damage for AoE (2nd+ use before Long Rest)
           if (context?.overchannelActive && context?.overchannelUseCount > 1) {
               const overchannelSpellLevel = context?.overchannelSpellLevel || 1;
               const dicePerLevel = 2 + (context.overchannelUseCount - 1);
               const totalDice = dicePerLevel * overchannelSpellLevel;
               const necroticFormula = `${totalDice}d12`;
               const necroticResult = rollExpression(necroticFormula);
               if (necroticResult) {
                   const casterCombatSummary = await loadCombatSummary(campaignName);
                   const casterApplyResult = applyDamageToTarget(casterCombatSummary, characterName, necroticResult.total, ['Necrotic'], campaignName, null, true, characterName);
                   logEntry({
                       type: 'roll',
                       characterName,
                       rollType: 'overchannel-damage',
                       name: 'Overchannel',
                       formula: necroticFormula,
                       rolls: necroticResult.rolls,
                       total: necroticResult.total,
                       modifier: necroticResult.modifier,
                       damageType: 'Necrotic',
                       targetName: characterName,
                       finalDamage: casterApplyResult?.finalDamage,
                       note: 'Overchannel self-damage (ignores resistance/immunity)',
                   });
               }
               const usesKey = '_Overchannel_uses';
               const restKey = '_Overchannel_restTimestamp';
               const now = Date.now();
               const lastRestTimestamp = getRuntimeValue(characterName, restKey, campaignName);
               let currentUses;
               if (lastRestTimestamp && now - lastRestTimestamp < 86400000) {
                   currentUses = Number(getRuntimeValue(characterName, usesKey, campaignName) ?? 1);
               } else if (!lastRestTimestamp) {
                   currentUses = Number(getRuntimeValue(characterName, usesKey, campaignName) ?? 1);
               } else {
                   currentUses = 1;
               }
               if (currentUses > 0) {
                   await setRuntimeValue(characterName, usesKey, currentUses - 1, campaignName);
               }
           }

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
            const isSoulstitchProtected = hasSoulstitchProtection(target.name, characterName, campaignName);
             const saveResult = rollSaveForCreature(target, saveType, saveDc, disadvantage);
             let finalDamage = isSoulstitchProtected ? 0 : computeDamageAfterSave(adjustedTotal, saveResult.success, dcSuccess);
             const isCantripFlag = context?.isCantrip || false;
             const hasPotentFlag = hasPotentCantrip(context?.playerStats);
             if (!isSoulstitchProtected && hasPotentFlag && isCantripFlag && saveResult.success && dcSuccess === 'none') {
               finalDamage = Math.floor(adjustedTotal / 2);
             }
               const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;
               const applyResult = applyDamageToTarget(combatSummary, target.name, finalDamage, [damageType], campaignName, null, ignoreResistance, characterName);

            if (applyResult && applyResult.finalDamage > 0) {
              endInvisibilityOnHostileAction(characterName, campaignName);
            }

            if (!saveResult.success && context?.statusEffects?.length > 0) {
                for (const effect of context.statusEffects) {
                    const condKey = String(effect).toLowerCase();
                    const targetCharacter = (characters || []).find(c => utils.getName(c.name) === target.name);
                    const targetStats = targetCharacter?.computedStats || targetCharacter;
                    const attackerCreature = combatSummary?.creatures?.find(c => c.name === characterName);
                    if (targetStats && playerIsImmuneToCondition({
                        conditionKey: condKey,
                        playerStats: targetStats,
                        getRuntimeValue: getRuntimeValue,
                        campaignName: campaignName,
                        sourceCreatureType: attackerCreature?.type,
                    })) {
                        continue;
                    }
                    if (target.type === 'player') {
                        const conditions = getRuntimeValue(target.name, 'activeConditions') || [];
                        const filtered = conditions.filter(c => String(c).toLowerCase() !== condKey);
                        setRuntimeValue(target.name, 'activeConditions', [...filtered, condKey], campaignName);
                    } else {
                        target.conditions = (target.conditions || []).filter(c => c.key !== condKey);
                        target.conditions.push({
                            id: utils.guid(),
                            key: condKey,
                            label: effect.charAt(0).toUpperCase() + effect.slice(1),
                            dc: saveDc,
                            ability: saveType.toLowerCase(),
                            endsOnDamage: true,
                        });
                    }
                }
            }

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
              saveResult: isSoulstitchProtected ? 'soulstitch_auto_success' : (saveResult.success ? 'success' : 'failure'),
              saveRoll: saveResult.roll,
              saveBonus: saveResult.bonus,
              saveRawRolls: saveResult.rawRolls,
              mode: disadvantage ? 'disadvantage' : 'normal',
              finalDamage: applyResult?.finalDamage ?? total,
              soulstitchProtected: isSoulstitchProtected,
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

            // Overchannel self-damage (2nd+ use before Long Rest)
            if (context?.overchannelActive && context?.overchannelUseCount > 1) {
                const overchannelSpellLevel = context?.overchannelSpellLevel || 1;
                const dicePerLevel = 2 + (context.overchannelUseCount - 1);
                const totalDice = dicePerLevel * overchannelSpellLevel;
                const necroticFormula = `${totalDice}d12`;
                const necroticResult = rollExpression(necroticFormula);
                if (necroticResult) {
                    const casterCombatSummary = await loadCombatSummary(campaignName);
                    const casterApplyResult = applyDamageToTarget(casterCombatSummary, characterName, necroticResult.total, ['Necrotic'], campaignName, null, true, characterName);
                    logEntry({
                        type: 'roll',
                        characterName,
                        rollType: 'overchannel-damage',
                        name: 'Overchannel',
                        formula: necroticFormula,
                        rolls: necroticResult.rolls,
                        total: necroticResult.total,
                        modifier: necroticResult.modifier,
                        damageType: 'Necrotic',
                        targetName: characterName,
                        finalDamage: casterApplyResult?.finalDamage,
                        note: 'Overchannel self-damage (ignores resistance/immunity)',
                    });
                }
            }

          if (context?.metamagicHeighten || context?.metamagicCareful || context?.metamagicTwinTarget) {
            saveLastDamageEvent(characterName, {
              targetName: target.name,
              spellName: name,
              damageFormula: formula,
              rawDamage: adjustedTotal,
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
               let twinFinalDamage = computeDamageAfterSave(total, twinSaveResult.success, dcSuccess);
               if (hasPotentFlag && isCantripFlag && twinSaveResult.success && dcSuccess === 'none') {
                 twinFinalDamage = Math.floor(total / 2);
               }
                const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;
                 const twinApplyResult = applyDamageToTarget(combatSummary, twinTarget.name, twinFinalDamage, [damageType], campaignName, null, ignoreResistance, characterName);
               if (twinApplyResult && twinApplyResult.finalDamage > 0) {
                 endInvisibilityOnHostileAction(characterName, campaignName);
               }
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

          if (context?.multiTarget) {
            const multiTarget = combatSummary?.creatures?.find(c => c.name === context.multiTarget);
            if (multiTarget && multiTarget.name !== target.name) {
              if (saveType && saveDc) {
                const multiSaveResult = rollSaveForCreature(multiTarget, saveType, saveDc, false);
                let multiFinalDamage = computeDamageAfterSave(total, multiSaveResult.success, dcSuccess);
                if (hasPotentFlag && isCantripFlag && multiSaveResult.success && dcSuccess === 'none') {
                  multiFinalDamage = Math.floor(total / 2);
                }
                const multiApplyResult = applyDamageToTarget(combatSummary, multiTarget.name, multiFinalDamage, [damageType], campaignName, null);
                logEntry({
                  type: 'roll',
                  characterName,
                  rollType: 'save-damage',
                  name: `${name} (Words of Creation)`,
                  formula,
                  rolls,
                  total,
                  modifier,
                  damageType,
                  targetName: multiTarget.name,
                  saveType,
                  saveDc,
                  saveResult: multiSaveResult.success ? 'success' : 'failure',
                  saveRoll: multiSaveResult.roll,
                  saveBonus: multiSaveResult.bonus,
                  saveRawRolls: multiSaveResult.rawRolls,
                  mode: 'normal',
                  finalDamage: multiApplyResult?.finalDamage ?? total,
                });
                setPopupHtml(prev => ({
                  ...prev,
                  twinTargetName: multiTarget.name,
                  twinFinalDamage: multiApplyResult?.finalDamage,
                  twinTargetCurrentHp: multiApplyResult?.newHp,
                  twinTargetMaxHp: multiTarget.type === 'npc'
                    ? multiTarget.maxHp
                    : (getRuntimeValue(multiTarget.name, 'hitPoints') ?? 0),
                }));
              } else {
                const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;
                const multiApplyResult = applyDamageToTarget(combatSummary, multiTarget.name, total, [damageType], campaignName, null, ignoreResistance, characterName);
                if (multiApplyResult && multiApplyResult.finalDamage > 0) {
                  endInvisibilityOnHostileAction(characterName, campaignName);
                }
                logEntry({
                  type: 'roll',
                  characterName,
                  rollType: 'save-damage',
                  name: `${name} (Words of Creation)`,
                  formula,
                  rolls,
                  total,
                  modifier,
                  damageType,
                  targetName: multiTarget.name,
                  finalDamage: multiApplyResult?.finalDamage ?? total,
                });
              }
            }
          }
          return;
          }

         if (target.type === 'player') {
           const isCarefulAlly = context?.metamagicCareful || false;
           if (isCarefulAlly) {
             const carefulDamage = computeDamageAfterSave(adjustedTotal, true, dcSuccess);
                const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;
               const applyResult = applyDamageToTarget(combatSummary, target.name, carefulDamage, [damageType], campaignName, null, ignoreResistance, characterName);
             if (applyResult && applyResult.finalDamage > 0) {
               endInvisibilityOnHostileAction(characterName, campaignName);
             }
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
              rawDamage: adjustedTotal,
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
          const hasContactPatron = (context?.playerStats?.automation?.passives || []).some(
            p => p.type === 'passive_rule' && p.effect === 'contact_patron_auto_save'
          );
          if (hasContactPatron && name === 'Contact Other Plane' && target.name === characterName) {
            const successfulSave = computeDamageAfterSave(adjustedTotal, true, dcSuccess);
              const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;
              const applyResult = applyDamageToTarget(combatSummary, target.name, successfulSave, [damageType], campaignName, null, ignoreResistance, characterName);
             if (applyResult && applyResult.finalDamage > 0) {
               endInvisibilityOnHostileAction(characterName, campaignName);
             }
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
              finalDamage: successfulSave,
              note: 'Contact Patron: automatically succeed on saving throw',
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
              saveResult: { success: true, roll: 20, total: saveDc, bonus: 0 },
              finalDamage: successfulSave,
              damageApplied: true,
              damageReduced: false,
              contactPatron: true,
            });
            return;
          }
           const promptId = utils.guid();
             pendingSaves[promptId] = {
                 targetName: target.name, rawDamage: adjustedTotal, saveDc, saveType, dcSuccess,
                damageType, attackerName: attackerName || characterName, name, formula, modifier, rolls, campaignName, setPopupHtml,
                metamagicHeighten: context?.metamagicHeighten || false,
                isCantrip: context?.isCantrip || false,
                overchannelActive: context?.overchannelActive || false,
                overchannelUseCount: context?.overchannelUseCount || 0,
                overchannelSpellLevel: context?.overchannelSpellLevel || 1,
                statusEffects: context?.statusEffects || [],
                playerStats: context?.playerStats,
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
            rawDamage: adjustedTotal,
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
              rawDamage: adjustedTotal,
              attackerName: attackerName || characterName,
             });

            // Overchannel self-damage (2nd+ use before Long Rest) - apply immediately
            if (context?.overchannelActive && context?.overchannelUseCount > 1) {
                const overchannelSpellLevel = context?.overchannelSpellLevel || 1;
                const dicePerLevel = 2 + (context.overchannelUseCount - 1);
                const totalDice = dicePerLevel * overchannelSpellLevel;
                const necroticFormula = `${totalDice}d12`;
                const necroticResult = rollExpression(necroticFormula);
                if (necroticResult) {
                    const casterCombatSummary = await loadCombatSummary(campaignName);
                    const casterApplyResult = applyDamageToTarget(casterCombatSummary, characterName, necroticResult.total, ['Necrotic'], campaignName, null, true, characterName);
                    logEntry({
                        type: 'roll',
                        characterName,
                        rollType: 'overchannel-damage',
                        name: 'Overchannel',
                        formula: necroticFormula,
                        rolls: necroticResult.rolls,
                        total: necroticResult.total,
                        modifier: necroticResult.modifier,
                        damageType: 'Necrotic',
                        targetName: characterName,
                        finalDamage: casterApplyResult?.finalDamage,
                        note: 'Overchannel self-damage (ignores resistance/immunity)',
                    });
                }
                const usesKey = '_Overchannel_uses';
                const restKey = '_Overchannel_restTimestamp';
                const now = Date.now();
                const lastRestTimestamp = getRuntimeValue(characterName, restKey, campaignName);
                let currentUses;
                if (lastRestTimestamp && now - lastRestTimestamp < 86400000) {
                    currentUses = Number(getRuntimeValue(characterName, usesKey, campaignName) ?? 1);
                } else if (!lastRestTimestamp) {
                    currentUses = Number(getRuntimeValue(characterName, usesKey, campaignName) ?? 1);
                } else {
                    currentUses = 1;
                }
                if (currentUses > 0) {
                    await setRuntimeValue(characterName, usesKey, currentUses - 1, campaignName);
                }
            }

           return;
           }
         }

        let applyResult = null;
         if (target) {
           // Sentinel Halt: when player hits with an OA, target's Speed becomes 0 for rest of turn
           const lastAttack = getRuntimeValue(characterName, 'lastAttackRoll', campaignName);
           const attackHit = context?.isOpportunityAttack && lastAttack?.hit === true;
           if (attackHit) {
             const playerCharacter = (characters || []).find(c => c.name === characterName || c.name.startsWith(characterName + ' '));
             const computed = playerCharacter?.computedStats || playerCharacter;
             const allFeatures = computed?.characterAdvancement || [];
             const hasSentinel = allFeatures.some(f => f.name === 'Sentinel');
             if (hasSentinel) {
               const sentinelStoredEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
               const newEffect = {
                 target: target.name,
                 source: 'Sentinel',
                 option: 'Halt',
                 effect: 'speed_zero',
                 value: null,
                 duration: 'end_of_turn',
               };
               const updatedEffects = [...sentinelStoredEffects, newEffect];
               setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);
             }
           }
           // Ray of Enfeeblement: attacker with debuff subtracts 1d8 from damage
          let rayReduction = 0;
          const rayTargetEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
          const rayDebuffActive = rayTargetEffects.some(te => te.effect === 'ray_of_enfeeble_debuff' && te.source === (attackerName || characterName));
          if (rayDebuffActive) {
            const rayRoll = rollExpression('1d8');
            rayReduction = rayRoll?.total || 0;
          }
            const reducedTotal = Math.max(0, adjustedTotal - rayReduction);
            const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;
            applyResult = applyDamageToTarget(combatSummary, target.name, reducedTotal, [damageType], campaignName, null, ignoreResistance, characterName);
          if (rayReduction > 0) {
            applyResult = { ...applyResult, rayOfEnfeebleReduction: rayReduction };
          }
         }

        if (applyResult && applyResult.finalDamage > 0) {
          endInvisibilityOnHostileAction(characterName, campaignName);
        }

       // Death Strike: check for pending save, double damage on failure
       const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
       const deathStrikeEffect = storedEffects.find(te => te.effect === 'death_strike' && te.target === target?.name);
       if (deathStrikeEffect && target) {
         const dsSaveDc = deathStrikeEffect.saveDc;
         const dsSaveType = deathStrikeEffect.saveType;
         if (dsSaveDc && dsSaveType) {
           const dsSaveResult = rollSaveForCreature(target, dsSaveType, dsSaveDc, false);
             if (!dsSaveResult.success) {
               const doubledTotal = adjustedTotal * 2;
               const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, damageType)) || false;
                const dsApplyResult = applyDamageToTarget(combatSummary, target.name, doubledTotal, [damageType], campaignName, null, ignoreResistance || false, characterName);
             logEntry({
               type: 'roll',
               characterName,
               rollType: 'save-damage',
               name: 'Death Strike',
               formula: `2× ${formula}`,
               rolls,
               total: doubledTotal,
               modifier,
               damageType,
               targetName: target.name,
               saveType: dsSaveType,
               saveDc: dsSaveDc,
               saveResult: 'failure',
               saveRoll: dsSaveResult.roll,
               saveBonus: dsSaveResult.bonus,
               saveRawRolls: dsSaveResult.rawRolls,
               finalDamage: dsApplyResult?.finalDamage ?? doubledTotal,
               note: 'Death Strike: CON save failed, damage doubled',
             });
             if (!applyResult) {
               applyResult = dsApplyResult;
             }
             setPopupHtml(prev => ({
               ...prev,
               deathStrikeDoubled: true,
               deathStrikeSaveRoll: dsSaveResult.roll,
               deathStrikeSaveBonus: dsSaveResult.bonus,
               deathStrikeSaveDc: dsSaveDc,
               deathStrikeFinalDamage: dsApplyResult?.finalDamage,
             }));
           }
         }
         const cleanedEffects = storedEffects.filter(te => te.effect !== 'death_strike' || te.target !== target.name);
         setRuntimeValue(campaignName, 'targetEffects', cleanedEffects, campaignName);
       }

       // Multiattack Defense: when a creature hits the player, apply disadvantage to that attacker's subsequent attacks
       if (target?.type === 'player' && applyResult && applyResult.finalDamage > 0) {
           const attackerNameResolved = attackerName || characterName;
           const defensiveChoice = getRuntimeValue(target.name, '_Defensive_Tactics_choice', campaignName);
           if (defensiveChoice === 'Multiattack Defense') {
               const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
               const newEffect = {
                   target: target.name,
                   source: 'Defensive Tactics',
                   option: 'Multiattack Defense',
                   effect: 'multiattack_defense',
                   attacker: attackerNameResolved,
                   duration: 'until_end_of_current_turn',
               };
               const updatedEffects = [...storedEffects, newEffect];
               setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);
           }
       }

       // Ram: apply Prone on melee hit from Power of the Wilds
      if (context?.ramActive && context?.isMelee && target && applyResult) {
        const isLargeOrSmaller = !target.size || ['Tiny', 'Small', 'Medium', 'Large'].includes(target.size);
        if (isLargeOrSmaller) {
          if (target.type === 'player') {
            const conditions = getRuntimeValue(target.name, 'activeConditions', campaignName) || [];
            if (Array.isArray(conditions) && !conditions.some(c => String(c).toLowerCase() === 'prone')) {
              setRuntimeValue(target.name, 'activeConditions', [...conditions, 'Prone'], campaignName);
            }
          } else {
            target.conditions = target.conditions || [];
            if (!target.conditions.some(c => String(c.key).toLowerCase() === 'prone')) {
              target.conditions.push({ key: 'prone' });
              storage.set('combatSummary', combatSummary, campaignName);
            }
          }
          logEntry({
            type: 'condition',
            action: 'applied',
            characterName: target.name,
            condition: 'Prone',
            reason: 'Power of the Wilds (Ram)',
            timestamp: Date.now(),
          });
          window.dispatchEvent(new CustomEvent('combat-summary-updated'));
        }
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

       // Overchannel self-damage (2nd+ use before Long Rest)
       if (context?.overchannelActive && context?.overchannelUseCount > 1) {
           const overchannelSpellLevel = context?.overchannelSpellLevel || 1;
           const dicePerLevel = 2 + (context.overchannelUseCount - 1);
           const totalDice = dicePerLevel * overchannelSpellLevel;
           const necroticFormula = `${totalDice}d12`;
           const necroticResult = rollExpression(necroticFormula);
           if (necroticResult) {
               const casterCombatSummary = await loadCombatSummary(campaignName);
               const casterApplyResult = applyDamageToTarget(casterCombatSummary, characterName, necroticResult.total, ['Necrotic'], campaignName, null, true, characterName);
               logEntry({
                   type: 'roll',
                   characterName,
                   rollType: 'overchannel-damage',
                   name: 'Overchannel',
                   formula: necroticFormula,
                   rolls: necroticResult.rolls,
                   total: necroticResult.total,
                   modifier: necroticResult.modifier,
                   damageType: 'Necrotic',
                   targetName: characterName,
                   finalDamage: casterApplyResult?.finalDamage,
                   note: 'Overchannel self-damage (ignores resistance/immunity)',
               });
           }
           const usesKey = '_Overchannel_uses';
           const restKey = '_Overchannel_restTimestamp';
           const now = Date.now();
           const lastRestTimestamp = getRuntimeValue(characterName, restKey, campaignName);
           let currentUses;
           if (lastRestTimestamp && now - lastRestTimestamp < 86400000) {
               currentUses = Number(getRuntimeValue(characterName, usesKey, campaignName) ?? 1);
           } else if (!lastRestTimestamp) {
               currentUses = Number(getRuntimeValue(characterName, usesKey, campaignName) ?? 1);
           } else {
               currentUses = 1;
           }
           if (currentUses > 0) {
               await setRuntimeValue(characterName, usesKey, currentUses - 1, campaignName);
           }
       }

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
          total,
          adjustedTotal: adjustedTotal,
          elementalAdeptBonus: adjustedTotal > total ? adjustedTotal - total : 0,
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
             const twinApplyResult = applyDamageToTarget(combatSummary, twinTarget.name, adjustedTotal, [damageType], campaignName, null, false, characterName);
           if (twinApplyResult && twinApplyResult.finalDamage > 0) {
             endInvisibilityOnHostileAction(characterName, campaignName);
           }
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

      if (context?.multiTarget && target) {
        const multiTarget = combatSummary?.creatures?.find(c => c.name === context.multiTarget);
        if (multiTarget && multiTarget.name !== target.name) {
          const multiApplyResult = applyDamageToTarget(combatSummary, multiTarget.name, total, [damageType], campaignName, null, false, characterName);
          logEntry({
            type: 'roll',
            characterName,
            rollType: 'damage',
            name: `${name} (Words of Creation)`,
            formula,
            rolls,
            total,
            modifier,
            damageType,
            targetName: multiTarget.name,
            finalDamage: multiApplyResult?.finalDamage,
          });
          setPopupHtml(prev => ({
            ...prev,
            twinTargetName: multiTarget.name,
            twinFinalDamage: multiApplyResult?.finalDamage,
            twinTargetCurrentHp: multiApplyResult?.newHp,
            twinTargetMaxHp: multiTarget.type === 'player'
              ? (getRuntimeValue(multiTarget.name, 'hitPoints') ?? 0)
              : multiTarget.maxHp,
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

   async function triggerGloriousDefenseCounterAttack() {
        const playerName = characterName;
        const chaBonus = 0;

        const usesKey = 'gloriousDefenseUses';
        const usesMax = Math.max(1, chaBonus);
        const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? usesMax);

        if (currentUses <= 0) {
            setPopupHtml({
                type: 'd20',
                rollType: 'attack',
                name: 'Glorious Defense',
                rolls: [],
                bonus: 0,
                targetName: null,
                targetAc: null,
                hit: undefined,
                isAutoMiss: false,
                forcedMode: undefined,
                isCrit: false,
                isAutoCrit: false,
                gloriousDefenseBonus: 0,
                defensiveDuelistBonus: 0,
                popupMessage: `${characterName} has no uses remaining for Glorious Defense. Recharges on a Long Rest.`,
            });
            return;
        }

        await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);

        const cs = await getCombatContext(campaignName);
        const target = cs ? getTargetFromAttacker(cs, playerName) : null;
        const targetName = target?.name || null;

        const combatSummary = await loadCombatSummary(campaignName);
        const playerCreature = combatSummary?.creatures?.find(c => c.type === 'player' && c.name === playerName);
        const attacks = playerCreature?.attacks || [];
        const meleeAttacks = attacks.filter(a => a.range === MELEE_REACH_FEET);
        const attack = meleeAttacks.length > 0 ? meleeAttacks[0] : attacks[0];

        if (!attack) {
            await setRuntimeValue(playerName, usesKey, currentUses, campaignName);
            setPopupHtml({
                type: 'd20',
                rollType: 'attack',
                name: 'Glorious Defense',
                rolls: [],
                bonus: 0,
                targetName: null,
                targetAc: null,
                hit: undefined,
                isAutoMiss: false,
                forcedMode: undefined,
                isCrit: false,
                isAutoCrit: false,
                gloriousDefenseBonus: 0,
                defensiveDuelistBonus: 0,
                popupMessage: `${characterName} has no melee attack available.`,
            });
            return;
        }

        logEntry({
            type: 'ability_use',
            characterName: playerName,
            abilityName: 'Glorious Defense',
            description: `${playerName} used Glorious Defense counter-attack against ${targetName || 'attacker'}.`,
        }).catch(() => {});

        logAndShow(attack.name, attack.hitBonus, 'attack', { targetName, forcedMode: undefined });
    }

   async function quickRollPlayerSave(promptId, targetName, saveType, saveDc) {
    const pending = pendingSaves[promptId];
    if (!pending) return;

    const combatSummary = await loadCombatSummary(campaignName);
    const target = combatSummary?.creatures?.find(c => c.name === pending.targetName);
    if (!target) return;

    const disadvantage = pending.metamagicHeighten || false;
    const saveResult = rollSaveForCreature(target, saveType, saveDc, disadvantage);
    const saveTypeUpper = (saveType || '').toUpperCase();
    const targetChar = (charactersRef.current || []).find(c => c.name === pending.targetName);
    const targetConditions = getRuntimeValue(pending.targetName, 'activeConditions', campaignName) || [];
    const isIncapacitated = targetConditions.some(c => String(c).toLowerCase() === 'incapacitated');
    const ownEvasion = targetChar?.computedStats?.evasionEffects;
    const hasOwnEvasion = !isIncapacitated && pending.dcSuccess === 'half' && ownEvasion?.some(ef => ef.saveType === saveTypeUpper);
    const hasSharedEvasion = !hasOwnEvasion && !isIncapacitated && pending.dcSuccess === 'half' &&
      (charactersRef.current || []).some(c => {
        if (c.name === pending.targetName) return false;
        const ev = c?.computedStats?.evasionEffects;
        return ev?.some(ef => ef.saveType === saveTypeUpper && ef.shareable && ef.shareRange >= 5);
      });
    const hasEvasion = hasOwnEvasion || hasSharedEvasion;
    let finalDamage = computeDamageAfterEvasion(pending.rawDamage, saveResult.success, pending.dcSuccess, hasEvasion);

    // Shield spell: immunity to Magic Missile damage
    const targetActiveBuffs = getRuntimeValue(pending.targetName, 'activeBuffs', campaignName) || [];
    const isShieldActive = Array.isArray(targetActiveBuffs) && targetActiveBuffs.some(b => b.effect === 'shield');
    const isMagicMissile = pending.name && pending.name.toLowerCase() === 'magic missile';
    if (isShieldActive && isMagicMissile) {
      finalDamage = 0;
    }

    const interveneShieldActive = getRuntimeValue(pending.targetName, 'interveneShieldActive', campaignName);
    if (interveneShieldActive && pending.saveType === 'DEX' && pending.dcSuccess === 'half') {
        if (saveResult.success) {
            finalDamage = 0;
        }
        setRuntimeValue(pending.targetName, 'interveneShieldActive', null, campaignName);
    }

    const isCantripFlag = pending.isCantrip || false;
    const hasPotentFlag = hasPotentCantrip(pending.context?.playerStats);
    if (hasPotentFlag && isCantripFlag && saveResult.success && pending.dcSuccess === 'none') {
      finalDamage = Math.floor(pending.rawDamage / 2);
    }
    const ignoreResistance = (pending.playerStats && hasIgnoreResistance(pending.playerStats, pending.damageType)) || false;
    const applyResult = applyDamageToTarget(combatSummary, pending.targetName, finalDamage, [pending.damageType], campaignName, null, ignoreResistance, pending.attackerName || characterName);

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
     rollInitiative: (initBonus, context) => logAndShow('Initiative', initBonus, 'initiative', context),
       rollAttack: (name, hitBonus, context) => logAndShow(name, hitBonus, 'attack', context),
    rollDamage: (name, formula, total, rolls, modifier, context) => logDamageAndShow(name, formula, total, rolls, modifier, context),
    quickRollPlayerSave,
    triggerGloriousDefenseCounterAttack,
         };
       }
