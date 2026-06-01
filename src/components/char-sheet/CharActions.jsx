
import React, { useState, useEffect } from 'react'
import Popup from '../common/Popup.jsx'
import DiceRollResult from './DiceRollResult.jsx'
import { sanitizeHtml } from '../../services/sanitize.js';
import { parseMagicItemName } from '../../services/attackCalc.js';
import useLoggedDiceRoll from '../../hooks/useLoggedDiceRoll.js'
import { buildFeatureDetailHtml, showWeaponMasteryPopup } from '../../hooks/useActionPopup.js'
import { rollExpression, rollExpressionDoubled } from '../../services/diceRoller.js';
import { getTargetFromAttacker, getCombatContext, getResistanceNotice, getAttackerTargetName } from '../../services/damageUtils.js';
import * as mapsService from '../../services/mapsService.js';
import { computeRangeEffect, computeMeleeProximityEffect, getDistanceFeet, isHostileNPC, getNearestPlacedItem } from '../../services/rangeValidation.js';
import { computeCover } from '../../services/coverService.js';
import { computeFeatRangeEffects } from '../../services/featRangeService.js';
import { loadNPCs } from '../../services/npcsService.js';
import { hasAutomation, getAutomationInfo } from '../../services/automationService.js'
import storage from '../../services/storage.js'
import utils from '../../services/utils.js'
import HealingPoolModal from './HealingPoolModal.jsx'
import { getClassFeatures } from '../../services/classFeatures.js';
import { addEntry } from '../../services/logService.js';
import './CharActions.css'
import { isEqual } from 'lodash';

const signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });

const areEqual = (prevProps, nextProps) => isEqual(prevProps.playerStats, nextProps.playerStats);

const CharActions = React.memo(function CharActions({ playerStats, campaignName, exhaustionPenalty = 0, conditionAttackMode, cannotAct, mapName, onBuffsChange }) {
    const [actions, setActions] = useState([]);
    const [featRangeEffects, setFeatRangeEffects] = useState(null);
    const [healingPoolModal, setHealingPoolModal] = useState(null);

     useEffect(() => {
       computeFeatRangeEffects(playerStats.feats, playerStats.rules).then(setFeatRangeEffects).catch(() => {});
      }, [playerStats.feats, playerStats.rules]);

    useEffect(() => {
       fetch('/data/actions.json')
               .then(response => response.json())
                .then(data => setActions(data))
             .catch(error => console.error('Error loading actions:', error));
          }, []);

     // Passive: recover Focus Points when anyone rolls initiative
    useEffect(() => {
       const handleInitiativeRolled = (e) => {
         if (!playerStats || !e.detail || !e.detail.characterName) return;
         const rollingName = utils.getName(e.detail.characterName);
         const myName = utils.getName(playerStats.name);
         if (rollingName !== myName) return;

          // Check if this character has an initiative_action with regain_focus_points_and_heal effect
        const hasInitAction = playerStats.actions?.some(a => a.automation?.type === 'initiative_action');
       if (!hasInitAction) return;

         // Get max focus points from class data and set current to max
         const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
         const maxFP = classLevel?.focus_points || storage.getProperty(playerStats.name, 'focusPoints', campaignName) || 0;
         if (!maxFP) return;

         // Only recover if current is less than max (avoid unnecessary writes when already full)
         const currentFP = Number(storage.getProperty(playerStats.name, 'focusPoints', campaignName)) || 0;
         if (currentFP >= maxFP) return;

         storage.setProperty(playerStats.name, 'focusPoints', maxFP, campaignName);
       };
       window.addEventListener('initiative-rolled', handleInitiativeRolled);
       return () => window.removeEventListener('initiative-rolled', handleInitiativeRolled);
     }, [playerStats, campaignName]);
      const { popupHtml, setPopupHtml, rollAttack, rollDamage, quickRollPlayerSave } = useLoggedDiceRoll(playerStats.name, campaignName, {
        autoDamageRoll: (autoDamage, isCrit) => {
          const result = isCrit ? rollExpressionDoubled(autoDamage.formula) : rollExpression(autoDamage.formula);
          if (result) {
            rollDamage(autoDamage.name, autoDamage.formula, result.total, result.rolls, result.modifier, {
              damageType: autoDamage.damageType,
              targetName: autoDamage.targetName,
              attackerName: autoDamage.attackerName,
              saveDc: autoDamage.saveDc,
              saveType: autoDamage.saveType,
              dcSuccess: autoDamage.dcSuccess,
              });
            }
          },
        });

    const getCombatTargetInfo = React.useCallback(() => {
        const cs = getCombatContext();
        if (!cs) return null;
        const target = getTargetFromAttacker(cs, playerStats.name);
        if (!target) return null;
        return target;
    }, [playerStats.name]);

    const buildAttackContextSync = React.useCallback((attack) => {
        const target = getCombatTargetInfo();
        const targetName = target?.name || (() => {
            const cs = getCombatContext();
            return cs ? getAttackerTargetName(cs, playerStats.name) : undefined;
        })();
        const resistanceNotice = target ? getResistanceNotice([attack.damageType], target.resistances, target.immunities, target.name) : null;
        return {
            damageType: attack.damageType,
            resistanceNotice,
            targetName,
            saveDc: attack.saveDc,
            saveType: attack.saveType,
            dcSuccess: attack.saveSuccess,
            attackerName: playerStats.name,
            forcedMode: conditionAttackMode !== 'normal' ? conditionAttackMode : undefined,
            autoDamageFormula: attack.damage,
            autoDamageName: attack.name,
        };
    }, [getCombatTargetInfo, conditionAttackMode, playerStats.name]);

    const buildAttackContext = React.useCallback(async (attack) => {
        if (!mapName) {
            return buildAttackContextSync(attack);
        }

        const base = buildAttackContextSync(attack);

        try {
            const [mapData, npcs] = await Promise.all([
              mapsService.loadMapData(campaignName, mapName),
              loadNPCs(campaignName),
            ]);

            const attackerPlayer = mapData?.players?.find(p => p.name === playerStats.name);
            if (attackerPlayer) {
              let targetPos = null;
              const cs = getCombatContext();
              if (cs) {
                const target = getTargetFromAttacker(cs, playerStats.name);
                if (target) {
                  const targetPlayer = mapData?.players?.find(p => p.name === target.name);
                  const targetNpc = mapData?.placedItems?.length
                    ? getNearestPlacedItem(mapData.placedItems, target.name, { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY })
                    : null;
                  if (targetPlayer) {
                    targetPos = { gridX: targetPlayer.gridX, gridY: targetPlayer.gridY };
                  } else if (targetNpc) {
                    targetPos = { gridX: targetNpc.gridX, gridY: targetNpc.gridY };
                  }
                }
              }

              const isRanged = attack.range > 5;
              const feats = featRangeEffects || { ignoresMeleeDisadvantage: false, ignoresLongRangeDisadvantage: false, rangeMultiplier: 1, spellRangeBonus: 0 };

              if (targetPos) {
                const effectiveRange = isRanged ? attack.range + (feats.spellRangeBonus || 0) : attack.range;
                const distanceFt = getDistanceFeet(
                  { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                  targetPos
                );
                const rangeResult = computeRangeEffect(effectiveRange, distanceFt, feats);
                if (rangeResult.mode === 'disadvantage') {
                  base.forcedMode = 'disadvantage';
                  base.rangeReason = rangeResult.reason;
                } else if (rangeResult.mode === 'miss') {
                  base.isAutoMiss = true;
                  base.rangeReason = rangeResult.reason;
                  base.forcedMode = undefined;
                }
              }

              // Cover determination (ranged only - melee always has no cover)
              if (isRanged && !base.isAutoMiss && targetPos) {
                const walls = mapData?.walls || new Set()
                const coverResult = computeCover(
                  { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                  { gridX: targetPos.gridX, gridY: targetPos.gridY },
                  walls,
                  mapData?.placedItems || [],
                )
                if (coverResult.level === 'full') {
                  base.isAutoMiss = true
                  base.rangeReason = 'Target has full cover'
                } else if (coverResult.acBonus > 0) {
                  base.coverAcBonus = coverResult.acBonus
                  base.coverLevel = coverResult.level
                }
              }

              if (isRanged && !base.isAutoMiss) {
                const nearbyThreats = (mapData?.placedItems || [])
                  .filter(i => i.type === 'npc')
                  .map(i => {
                    const npcData = npcs?.find(n => n.name === i.name || n.name === i.name?.replace(/\s+\d+$/, ''));
                    return { ...i, attitude: npcData?.attitude };
                  })
                  .filter(i => isHostileNPC(i))
                  .map(i => ({ gridX: i.gridX, gridY: i.gridY, name: i.name }));

                const meleeResult = computeMeleeProximityEffect(true, attackerPlayer, nearbyThreats, feats);
                if (meleeResult.mode === 'disadvantage' && base.forcedMode !== 'disadvantage') {
                  base.forcedMode = 'disadvantage';
                  base.rangeReason = meleeResult.reason;
                }
              }
            }
          } catch (e) { /* fallback, no range validation */ }

        return base;
    }, [buildAttackContextSync, campaignName, mapName, playerStats.name, featRangeEffects]);

    const handleDamageClick = (attack) => {
        const wasCrit = popupHtml?.isCrit;
        if (wasCrit && setPopupHtml) setPopupHtml(null);
        const result = wasCrit ? rollExpressionDoubled(attack.damage) : rollExpression(attack.damage);
        if (result) {
            if (!mapName) {
              rollDamage(attack.name, attack.damage, result.total, result.rolls, result.modifier, buildAttackContextSync(attack));
            } else {
              buildAttackContext(attack).then(ctx => {
                rollDamage(attack.name, attack.damage, result.total, result.rolls, result.modifier, ctx);
              }).catch(() => {});
            }
        }
    };

    const handleAttackClick = React.useCallback((attack) => {
      if (cannotAct) return;
      if (!mapName) {
        const ctx = buildAttackContextSync(attack);
        rollAttack(attack.name, attack.hitBonus - exhaustionPenalty, ctx);
      } else {
        buildAttackContext(attack).then(ctx => {
          rollAttack(attack.name, attack.hitBonus - exhaustionPenalty, ctx);
        }).catch(() => {});
      }
    }, [cannotAct, mapName, buildAttackContextSync, buildAttackContext, rollAttack, exhaustionPenalty]);

    const MONK_KI_FEATURES = ['Flurry of Blows', 'Patient Defense', 'Step of the Wind', 'Heightened Flurry of Blows', 'Heightened Patient Defense', 'Heightened Step of the Wind'];

    const handleAutomationAction = async (action) => {
        if (cannotAct) return;
        const auto = action.automation;
        if (!auto) return;

        // Spend 1 focus point for monk Ki features
        if (MONK_KI_FEATURES.includes(action.name)) {
            const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
            const maxFP = classLevel?.focus_points || getClassFeatures(playerStats)?.maxFocusPoints || 0;
            const storedFP = storage.getProperty(playerStats.name, 'focusPoints', campaignName);
              // If not yet stored, current equals max (same init logic as TrackedResourceInput)
            const currentFP = storedFP != null ? Number(storedFP) : maxFP;
            if (currentFP <= 0) {
                 setPopupHtml(`<b>${action.name}</b><br/>No ${playerStats.rules === '2024' ? "Focus Points" : 'ki points'} remaining.`);
              return;
            }
             await storage.setProperty(playerStats.name, 'focusPoints', currentFP - 1, campaignName);

              // Notify other components that focus points changed
            window.dispatchEvent(new CustomEvent('focus-points-updated'));

             // Log the ability use and focus point consumption
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerStats.name,
                abilityName: action.name,
                description: `${action.name} activated`,
                focusPointsSpent: 1,
                remainingFocusPoints: currentFP - 1
            }).catch(() => {});

            // Show activation confirmation
            setPopupHtml(`<b>${action.name}</b><br/>${playerStats.rules === '2024' ? 'Focus Point' : 'Ki point'} spent. ${currentFP - 1} remaining.`);
            return;
        }

        switch (auto.type) {
            case 'save_attack': {
                const damageResult = rollExpression(auto.damage);
                if (damageResult) {
                    const dcSuccess = auto.shape === 'cone' ? 0.5 : 0;
                    // Resolve save DC: "ability" means 8 + CON mod + proficiency
                    let saveDc;
                    if (auto.saveDc === 'ability') {
                        const conBonus = playerStats.abilities?.find(a => a.name === 'CON')?.bonus || 0;
                        const prof = playerStats.proficiency || 0;
                        saveDc = 8 + conBonus + prof;
                    } else {
                        saveDc = auto.saveDc || 10;
                    }
                    const ctx = buildAttackContextSync({
                        name: action.name,
                        damage: auto.damage,
                        damageType: auto.damageType || '',
                        saveDc,
                        saveType: auto.saveType || 'DEX',
                        saveSuccess: dcSuccess,
                    });
                    rollDamage(action.name, auto.damage, damageResult.total, damageResult.rolls, damageResult.modifier, ctx);
                }
                break;
            }
            case 'healing':
            case 'self_healing': {
                const healAmount = auto.healAmount || auto.healExpression;
                if (setPopupHtml) {
                    setPopupHtml({
                        type: 'healing',
                        name: action.name,
                        healAmount: typeof healAmount === 'number' ? healAmount : auto.healExpression,
                        description: `${action.name}: Restores ${auto.healExpression} HP`,
                    });
                }
                break;
            }
             case 'healing_pool': {
                setHealingPoolModal({
                    name: action.name,
                    pool: auto.pool,
                    resourceKey: auto.resourceKey,
                    alsoCures: auto.alsoCures || [],
                    cureCost: auto.cureCost || 5,
                  });
                break;
            }
            case 'free_spell': {
                const spellName = auto.spell || action.name;
                let spellData = (playerStats.spellAbilities?.spells || []).find(s => s.name === spellName);
                if (!spellData) {
                    try {
                        const spellsUrl = playerStats.rules === '2024' ? '/data/2024/spells.json' : '/data/spells.json';
                        const response = await fetch(spellsUrl);
                        const allSpells = await response.json();
                        spellData = allSpells.find(s => s.name === spellName);
                    } catch (e) {
                        // Fetch failed, fall through to description popup
                    }
                }
                if (spellData?.damage) {
                    const slotDmg = spellData.damage.damage_at_slot_level;
                    const formula = slotDmg?.[Object.keys(slotDmg)[0]];
                    if (formula) {
                        const result = rollExpression(formula);
                        if (result) {
                            const target = getCombatTargetInfo();
                            rollDamage(spellName, formula, result.total, result.rolls, result.modifier, {
                                damageType: spellData.damage.damage_type || 'Radiant',
                                targetName: target?.name,
                                attackerName: playerStats.name,
                            });
                            break;
                        }
                    }
                }
                if (setPopupHtml) {
                    const usesInfo = auto.uses ? ` (${auto.uses}/long rest)` : '';
                    setPopupHtml(`<b>${action.name}</b><br/>${action.description || ''}<br/><br/><b>Free cast of:</b> ${spellName}${usesInfo}`);
                }
                break;
            }
            case 'temp_buff': {
                const activeBuffsKey = 'activeBuffs';
                const stored = storage.getProperty(playerStats.name, activeBuffsKey, campaignName);
                const activeBuffs = Array.isArray(stored) ? stored : [];
                const isActive = activeBuffs.some(b => b.name === action.name);
                const newBuffs = isActive ? activeBuffs.filter(b => b.name !== action.name) : [...activeBuffs, { name: action.name, effect: auto.effect, duration: auto.duration }];
                storage.setProperty(playerStats.name, activeBuffsKey, newBuffs, campaignName);
                if (onBuffsChange) onBuffsChange();
                if (setPopupHtml) {
                    setPopupHtml({
                        type: 'automation_info',
                        name: action.name,
                        automationType: auto.type,
                        description: isActive ? `${action.name} toggled OFF` : `${action.name} activated (${auto.duration || '10 min'})`,
                        automation: auto,
                     });
                }
               break;
            }
            case 'temp_hp_buff': {
                // Temp HP doesn't modify speed display, just show info popup
                if (setPopupHtml) {
                    const result = rollExpression(auto.buffExpression || '');
                    let desc = `${action.name}: ${auto.buffExpression} temp HP`;
                    if (result) desc += ` (${result.total})`;
                    setPopupHtml({
                        type: 'automation_info',
                        name: action.name,
                        automationType: auto.type,
                        description: desc,
                        automation: auto,
                     });
                }
               break;
            }
            case 'extra_action':
            case 'bonus_attacks':
            case 'bonus_action_attack':
            case 'damage_aura':
            case 'combat_stance':
            case 'resource_pool':
            case 'attack_rider':
            case 'spell_modifier':
            case 'damage_bonus': {
                if (setPopupHtml) {
                    setPopupHtml({
                        type: 'automation_info',
                        name: action.name,
                        automationType: auto.type,
                        description: action.description || '',
                        automation: auto,
                      });
                  }
                break;
              }
             case 'initiative_action': {
               if (auto.effect === 'regain_focus_points_and_heal') {

                    // Check use tracking against long-rest limit
                   const resourceKey = auto.resourceKey || action.name.toLowerCase().replace(/\s+/g, '') + 'Uses';
                  const usesUsed = Number(storage.getProperty(playerStats.name, resourceKey, campaignName) ?? 0);
                 if (usesUsed >= (auto.usesMax || auto.uses || 1)) {
                    if (setPopupHtml) {
                       setPopupHtml({
                          type: 'automation_info',
                           name: action.name,
                          automationType: auto.type,
                           description: `${action.name} has been used and cannot be used again until a long rest.` +
                             (auto.recharge === 'long_rest' ? '' : ` Recharges on ${auto.recharge || 'short rest'}.`),
                         });
                        }
                     return;
                    }

                  // Get martial arts die from class data
                 const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
                const martialArtsDie = classLevel?.martial_arts_die || 4;
               const monkLevel = playerStats.level;

                   // Roll the martial arts die
                  const rollResult = rollExpression(`${martialArtsDie}d1`);
                 if (!rollResult) return;

                   const healAmount = monkLevel + rollResult.total;

                  // Get current HP from storage
                const currentHp = Number(storage.getProperty(playerStats.name, 'currentHitPoints', campaignName)) || 0;
               const maxHp = playerStats.hitPoints;
                  const newHp = Math.min(maxHp, currentHp + healAmount);

                 // Update HP in storage (triggers SSE broadcast to other clients)
                   storage.setProperty(playerStats.name, 'currentHitPoints', newHp, campaignName);

                   // Also update combat summary if in combat
                   const combatSummary = (() => {
                         try {
                                 const cs = getCombatContext();
                                return cs;
                             } catch (e) { return null; }
                           })();
                     if (combatSummary) {
                          const creature = combatSummary.creatures.find(c => c.name === playerStats.name || c.name.startsWith(playerStats.name + ' '));
                             if (creature) {
                                 creature.currentHp = newHp;
                                  storage.set('combatSummary', combatSummary, campaignName);
                               }
                            }

                    // Increment use count
                   const newUsesUsed = usesUsed + 1;
                 storage.setProperty(playerStats.name, resourceKey, newUsesUsed, campaignName);

                   // Log to campaign log as a healing entry with source name
                 fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
                        method: 'POST',
                       headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          type: 'hp_change',
                           targetName: playerStats.name,
                           sourceName: action.name,
                           delta: newHp - currentHp,
                          currentHp: newHp,
                           maxHp,
                         isHealing: true,
                           isUnconscious: false,
                        }),
                     }).catch(() => {});

                   // Also dispatch combat-summary-updated for local sync
                  window.dispatchEvent(new CustomEvent('combat-summary-updated'));

                   // Show popup with roll result and healing info
                 if (setPopupHtml) {
                      setPopupHtml({
                         type: 'healing',
                          name: action.name,
                           formula: `${martialArtsDie}d1 + ${monkLevel}`,
                          rolls: rollResult.rolls,
                            bonus: monkLevel,
                             modifier: 0,
                           healAmount: healAmount,
                         description: `${action.name}: Rolled ${rollResult.total} (${martialArtsDie}d1) + ${monkLevel} (Monk level) = <strong>${healAmount}</strong> HP`,
                            targetName: playerStats.name,
                          targetCurrentHp: newHp,
                             targetMaxHp: maxHp,
                         damageApplied: true,
                  });
                   }
               } else {
                 if (setPopupHtml) {
                     setPopupHtml({
                        type: 'automation_info',
                       name: action.name,
                       automationType: auto.type,
                        description: action.description || '',
                       automation: auto,
                      });
                   }
                  break;
                }
               break;
              }
            default:
                break;
        }
    };
    const getWeaponMastery = (weaponName) => {
        if (playerStats.rules !== '2024') {
        return null;
         }

         // Remove magic prefix if present
        const nonMagicalName = parseMagicItemName(weaponName).baseName;

         // Find the weapon in equipment
        const weapon = playerStats.equipment?.find(item => item.name === nonMagicalName);
        if (weapon && weapon.equipment_category === 'Weapon') {
            return weapon.mastery;
        }
        return null;
    };

    const is2024Rules = playerStats.rules === '2024';

    return (
        <div className="char-actions">
            <div>
                <span className='sectionHeader'>Actions</span>
                {cannotAct && <span className='disabled-attack-label'>(Incapacitated)</span>}
                <div className={`attacks ${is2024Rules ? 'mastery-enabled' : ''}`}>
                    <div className='left'><b>Name</b></div>
                    <div><b>Range</b></div>
                    <div><b>Hit</b></div>
                    <div><b>Damage</b></div>
                    <div className='left'><b>Type</b></div>
                    {is2024Rules && <div><b>Mastery</b></div>}
                    {playerStats.attacks.map((attack) => {
                        if (attack.type != 'Action') return '';
                        return <React.Fragment key={attack.name}>
                            <div className='left'>{attack.name}</div>
                            <div>{attack.range} ft.</div>
                              {attack.saveDc
                                  ? <div className="save-dc-display">DC {attack.saveDc} {attack.saveType}</div>
                                  : <div className={"clickable" + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? " stat--penalized" : "") + (cannotAct ? " disabled-attack" : "")} onClick={() => handleAttackClick(attack)}>{signFormatter.format(attack.hitBonus - exhaustionPenalty)}</div>}
                              <div className={attack.damage ? "clickable" : ""} onClick={() => !cannotAct && handleDamageClick(attack)}>{attack.damage}</div>

                              <div className='left'>{attack.damageType}</div>
                              {is2024Rules && <div className={getWeaponMastery(attack.name) ? "clickable" : ""} onClick={() => { const mastery = getWeaponMastery(attack.name); if (mastery) showWeaponMasteryPopup(mastery, setPopupHtml); }}>{getWeaponMastery(attack.name) || ''}</div>}
                          </React.Fragment>;
                      })}
                  </div>
                  <br />
                                      {popupHtml && (
                                          <Popup onClickOrKeyDown={() => setPopupHtml && setPopupHtml(null)}>
                                              {typeof popupHtml === 'string' ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml) }}></div> : 
                                               popupHtml.type === 'automation_info' ? <div className="dice-roll-result"><div className="dice-roll-header"><i className="fa-solid fa-info-circle"></i>{popupHtml.name}</div><div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml.description) }}></div><div className="dice-roll-hint">click to dismiss</div></div> :
                                               <DiceRollResult {...popupHtml} onQuickRoll={popupHtml.waitingForPlayerSave ? () => quickRollPlayerSave(popupHtml.promptId, popupHtml.targetName, popupHtml.saveType, popupHtml.saveDc) : undefined} />}
                                          </Popup>
                                      )}
                  {healingPoolModal && (
                      <HealingPoolModal
                         playerStats={playerStats}
                         campaignName={campaignName}
                         poolMax={healingPoolModal.pool}
                         poolExpression={healingPoolModal.poolExpression}
                         alsoCures={healingPoolModal.alsoCures}
                         cureCost={healingPoolModal.cureCost}
                         onClose={() => setHealingPoolModal(null)}
                      />
                  )}
                {playerStats.actions.map((action) => {
                    const isClickable = action.details || hasAutomation(action);
                    const handleClick = () => {
                        if (hasAutomation(action)) {
                            handleAutomationAction(action);
                        } else {
                            setPopupHtml(buildFeatureDetailHtml(action));
                        }
                    };
                    return <div key={action.name}>
                        <b className={isClickable ? "clickable" : ""} onClick={handleClick}>{action.name}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(action.description) }}></span>
                        {hasAutomation(action) && action.automation?.type === 'save_attack' && action.automation?.saveDc && <span className="automation-badge"> DC {action.automation.saveDc} {action.automation.saveType}</span>}
                        {hasAutomation(action) && action.automation?.type === 'healing_pool' && <span className="automation-badge"> Pool: {action.automation.pool} HP</span>}
                        {hasAutomation(action) && action.automation?.damage && <span className="automation-badge"> {action.automation.damage} {action.automation.damageType}</span>}
                    </div>
                })}
                <div><b>Base Actions:</b> {actions.join(', ')}</div>
            </div>
            <div>
                {playerStats.attacks.find((attack) => attack.type === 'Bonus Action') && <div>
                    <hr />
                    <div className='sectionHeader'>Bonus Actions</div>
                    <div className={`attacks ${is2024Rules ? 'mastery-enabled' : ''}`}>
                        <div className='left'><b>Name</b></div>
                        <div><b>Range</b></div>
                        <div><b>Hit</b></div>
                        <div><b>Damage</b></div>
                        <div className='left'><b>Type</b></div>
                        {is2024Rules && <div><b>Mastery</b></div>}
                        {playerStats.attacks.map((attack) => {
                            if (attack.type != 'Bonus Action') return '';
                            return <React.Fragment key={attack.name}>
                                <div className='left'>{attack.name}</div>
                                <div>{attack.range} ft.</div>
                              {attack.saveDc
                                  ? <div className="save-dc-display">DC {attack.saveDc} {attack.saveType}</div>
                                  : <div className={"clickable" + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? " stat--penalized" : "") + (cannotAct ? " disabled-attack" : "")} onClick={() => handleAttackClick(attack)}>{signFormatter.format(attack.hitBonus - exhaustionPenalty)}</div>}
                                <div className={attack.damage ? "clickable" : ""} onClick={() => !cannotAct && handleDamageClick(attack)}>{attack.damage}</div>
                                   <div className='left'>{attack.damageType}</div>
                                   {is2024Rules && <div className={getWeaponMastery(attack.name) ? "clickable" : ""} onClick={() => { const mastery = getWeaponMastery(attack.name); if (mastery) showWeaponMasteryPopup(mastery, setPopupHtml); }}>{getWeaponMastery(attack.name) || ''}</div>}
                               </React.Fragment>;
                           })}
                       </div>
                   </div>}
                {/* No Bonus Action Attacks and only Bonus Actions so the Bonus Actions are the section's header */}
                {!playerStats.attacks.find((attack) => attack.type === 'Bonus Action') && playerStats.bonusActions.length > 0 && <div>
                    <div className='sectionHeader'>Bonus Actions</div>
                </div>}
                {/* Bonus Action Attacks and Bonus Actions so there has already been a section header and the Bonus Actions are a sub section */}
                {playerStats.attacks.find((attack) => attack.type === 'Bonus Action') && playerStats.bonusActions.length > 0 && <div>
                    <br />
                    {(playerStats.bonusActions.length > 0) && <div>
                        {playerStats.bonusActions.map((bonusAction) => {
                            const isBonusClickable = bonusAction.details || hasAutomation(bonusAction);
                            const handleBonusClick = () => {
                                if (hasAutomation(bonusAction)) {
                                    handleAutomationAction(bonusAction);
                                } else {
                                    setPopupHtml(buildFeatureDetailHtml(bonusAction));
                                }
                            };
                            return <div key={bonusAction.name}>
                 {popupHtml && (
                     <Popup onClickOrKeyDown={() => setPopupHtml && setPopupHtml(null)}>
                         {typeof popupHtml === 'string' ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml) }}></div> : 
                          popupHtml.type === 'automation_info' ? <div className="dice-roll-result"><div className="dice-roll-header"><i className="fa-solid fa-info-circle"></i>{popupHtml.name}</div><div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml.description) }}></div><div className="dice-roll-hint">click to dismiss</div></div> :
                          <DiceRollResult {...popupHtml} onQuickRoll={popupHtml.waitingForPlayerSave ? () => quickRollPlayerSave(popupHtml.promptId, popupHtml.targetName, popupHtml.saveType, popupHtml.saveDc) : undefined} />}
                     </Popup>
                 )}
                                   <b className={isBonusClickable ? "clickable" : ""} onClick={handleBonusClick}>{bonusAction.name}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(bonusAction.description) }}></span>
                                  {hasAutomation(bonusAction) && bonusAction.automation?.type === 'healing_pool' && <span className="automation-badge"> Pool: {bonusAction.automation.pool} HP</span>}
                                  {hasAutomation(bonusAction) && bonusAction.automation?.damage && <span className="automation-badge"> {bonusAction.automation.damage} {bonusAction.automation.damageType}</span>}
                             </div>
                        })}
                    </div>}
                </div>}
            </div>
        </div>
    )
}, areEqual);

export default CharActions