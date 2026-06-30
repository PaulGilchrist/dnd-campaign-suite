import React, { useState } from 'react'
import Popup from '../common/popup.jsx'
import MetamagicPopup from './popups/MetamagicPopup.jsx'
import SpellDetailPopup from './char-spells/SpellDetailPopup.jsx'
import { getCategories } from '../../services/character/featureCategories.js'
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { showWeaponMasteryPopup, buildFeatureDetailHtml } from '../../hooks/combat/useActionPopup.js'
import { hasAutomation } from '../../services/combat/automation/automationService.js'
import { isExhausted } from '../../services/automation/handlers/combat/saveAttackHandler.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { useSpellMetamagicFlow } from '../../hooks/combat/useSpellMetamagicFlow.js'
import { useSpellUpcastFlow } from '../../hooks/combat/useSpellUpcastFlow.js'
import { executeSpellCast } from '../../services/rules/spells/spellCastService.js'
import { getCurrentCombatRound } from '../../services/encounters/combatData.js'
import * as mapsService from '../../services/maps/mapsService.js';
import { getNearestPlacedItem } from '../../services/rules/combat/rangeValidation.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getInnateSorceryBonus } from '../../services/combat/buffs/buffService.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';
import { rollExpression } from '../../services/dice/diceRoller.js';
import { addEntry } from '../../services/ui/logService.js';
import './CharActions.css'

const signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });
const bonusActionCastingTimes = ['1 bonus action', '1 Bonus Action', 'bonus action', 'Bonus Action'];
const actionCastingTimes = ['1 action', '1 Action', 'action', 'Action'];

function formatRange(range) {
    if (!range && range !== 0) return '';
    let s = String(range);
    // Plain number: append ft.
    if (/^\d+$/.test(s)) return s + ' ft.';
    // Normalize: strip trailing dots/spaces, convert feet/foot to ft
    s = s.replace(/\.\s*$/, '');
    s = s.replace(/\bfeet\b/gi, 'ft');
    s = s.replace(/\bfoot\b/gi, 'ft');
    // Add the trailing dot
    s = s.replace(/(\d+)\s*ft$/i, '$1 ft.');
    s = s.replace(/(\d+\/\d+)\s*ft$/i, '$1 ft.');
    return s;
}

function isElderChampionActive(playerName, campaignName) {
    try {
        const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
        const activeBuffs = Array.isArray(stored) ? stored : [];
        return activeBuffs.some(b => b.name === 'Elder Champion');
    } catch { return false; }
}

function isActionSpell(castingTime) {
    const ct = castingTime || '';
    return actionCastingTimes.includes(ct);
}

function CharBonusActions({ playerStats, campaignName, exhaustionPenalty, conditionAttackMode, cannotAct, mapName, characters, onAttackClick, onResolveSpellDamage, onAutomationAction, getWeaponMastery, rollAttack, rollDamage, getTargetInfo }) {
    const { popupHtml, setPopupHtml } = useDiceRollPopup();
    const [selectedBonusSpell, setSelectedBonusSpell] = useState(null);

    const { saveDcBonus: displaySaveDcBonus } = getInnateSorceryBonus(playerStats.name, campaignName);

    const is2024Rules = playerStats.rules === '2024';

    const handleBonusSpellClick = (spellName) => {
        const spell = bonusSpellNames[spellName];
        if (!spell) return;
        setSelectedBonusSpell(spell);
     };

    // To-Hit attacks: damage is ALWAYS rolled through the "To Hit" flow.
    // Direct damage click only logs a simple die roll — no targeting, no riders, no damage application.
    // This is the ONLY way to apply damage to a selected target: successful To Hit → auto-damage.
    const handleSimpleDamageRoll = React.useCallback(async (attack) => {
        const result = rollExpression(attack.damage);
        if (!result) return;
        if (popupHtml) setPopupHtml(null);
        await addEntry(campaignName, {
            type: 'roll',
            characterName: playerStats.name,
            rollType: 'damage',
            name: attack.name,
            formula: attack.damage,
            rolls: result.rolls,
            total: result.total,
            modifier: result.modifier,
            damageType: attack.damageType,
            note: 'Direct damage roll (no target)',
        });
        setPopupHtml({
            type: 'damage',
            name: attack.name,
            formula: attack.damage,
            rolls: result.rolls,
            total: result.total,
            modifier: result.modifier,
            damageType: attack.damageType,
            note: 'Direct damage roll (no target)',
        });
    }, [playerStats.name, campaignName, popupHtml, setPopupHtml]);

    const cachedBonusCastPosRef = React.useRef(null);

    const bonusCastAction = React.useCallback((spell, metaCtx) => {
      const pos = cachedBonusCastPosRef.current;
      executeSpellCast(spell, metaCtx, { rollAttack, rollDamage, playerStats, getTargetInfo, attackerPos: pos?.attackerPos, targetPos: pos?.targetPos, innateSorceryActive: !!displaySaveDcBonus, campaignName, mapName, characters }).then((result) => {
        if (result && result.healAmount > 0) {
          const bonusHealDetail = result.bonusDetails?.length > 0
            ? result.bonusDetails.map(d => `${d.amount} ${d.name}`).join(', ')
            : '';
          const rawTotal = result.rawTotal ?? result.healAmount;
          setPopupHtml({
            type: 'heal',
            name: spell.name,
            formula: result.formula,
            rolls: result.rolls || [],
            total: rawTotal,
            targetName: result.targetName,
            finalHeal: result.healAmount,
            bonusHeal: result.bonusHeal || 0,
            bonusHealDetail,
          });
        }
      }).catch((e) => { console.error('[CharBonusActions] executeSpellCast error:', e); });
      cachedBonusCastPosRef.current = null;
      }, [rollAttack, rollDamage, playerStats, getTargetInfo, displaySaveDcBonus, campaignName, mapName, characters, setPopupHtml]);
    const { pendingMetamagic, gateMetamagic, handleConfirm, handleSkip } = useSpellMetamagicFlow(playerStats, campaignName, bonusCastAction);
    const { buildUpcastLevels } = useSpellUpcastFlow(playerStats, campaignName);

    const resolveBonusSpellPositions = React.useCallback(async () => {
      if (!mapName) return;
      try {
        const [mapData] = await Promise.all([
          mapsService.loadMapData(campaignName, mapName),
        ]);
        const attackerPlayer = mapData?.players?.find(p => p.name === playerStats.name);
        if (attackerPlayer) {
          const cs = await getCombatContext(campaignName);
          const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
          if (target) {
            const targetPlayer = mapData?.players?.find(p => p.name === target.name);
            const targetNpc = mapData?.placedItems?.length
              ? getNearestPlacedItem(mapData.placedItems, target.name, attackerPlayer)
              : null;
            const targetPos = targetPlayer
              ? { gridX: targetPlayer.gridX, gridY: targetPlayer.gridY }
              : targetNpc
                ? { gridX: targetNpc.gridX, gridY: targetNpc.gridY }
                : null;
            if (targetPos) {
              cachedBonusCastPosRef.current = {
                attackerPos: { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                targetPos,
              };
            }
          }
        }
      } catch { /* positions unavailable */ }
    }, [mapName, campaignName, playerStats.name]);

    const handleBonusSpellCast = React.useCallback(async (spell, metaCtx) => {
      setSelectedBonusSpell(null);

      await resolveBonusSpellPositions();
      gateMetamagic(spell, metaCtx);
    }, [gateMetamagic, resolveBonusSpellPositions]);

    const bonusActionAttacks = playerStats.attacks.filter((attack) => {
        if (attack.type !== 'Bonus Action') return false;
        // Filter out Horde Breaker placeholder — UI will show it conditionally
        if (attack.isHordeBreaker) return false;
        // Filter out Light weapon bonus action attack when Nick mastery has been used this turn
        if (attack.properties?.includes('Light') && is2024Rules) {
            const nickUsedKey = '_Nick_UsedRound';
            const currentRound = getCurrentCombatRound();
            const nickUsedRound = getRuntimeValue(playerStats.name, nickUsedKey, campaignName);
            if (nickUsedRound === currentRound) {
                return false;
            }
        }
        return true;
    });
    const attackNames = new Set((playerStats.attacks || []).map(a => a.name));
    const elderActive = isElderChampionActive(playerStats.name, campaignName);
    const bonusActionSpells = playerStats.spellAbilities?.spells?.filter(spell => {
        const isBonusAction = bonusActionCastingTimes.includes(spell.casting_time);
        const isActionSpellSwift = elderActive && isActionSpell(spell.casting_time);
        return (isBonusAction || isActionSpellSwift) &&
          (spell.prepared === 'Always' || spell.prepared === 'Prepared') &&
          !attackNames.has(spell.name)
     }) || [];
    const hasBonusActions = playerStats.bonusActions.length > 0;
    const hordeBreakerAttack = playerStats.attacks.find(a => a.isHordeBreaker);
    const hunterPreyChoice = hordeBreakerAttack ? getRuntimeValue(playerStats.name, "_Hunter's Prey_choice", campaignName) : null;
    const isHordeBreakerActive = hunterPreyChoice === 'Horde Breaker';
    const usedKey = '_Hunters_Prey_HordeBreaker_UsedRound';
    const usedRound = getRuntimeValue(playerStats.name, usedKey, campaignName);
    const currentRound = getCurrentCombatRound();
    const isHordeBreakerAvailable = isHordeBreakerActive && usedRound !== currentRound && !cannotAct;
    const hasBonusContent = bonusActionSpells.length > 0 || bonusActionAttacks.length > 0 || hasBonusActions || isHordeBreakerAvailable;

    if (!hasBonusContent) return null;

    const bonusSpellNames = bonusActionSpells.reduce((acc, spell) => { acc[spell.name] = spell; return acc; }, {});

    const getAttackSpellLevel = (attackName) => {
        const spell = playerStats.spellAbilities?.spells?.find(s => s.name === attackName);
        return spell ? spell.level : null;
    };

    const allBonusItems = [
        ...bonusActionAttacks.map(a => ({ ...a, _isAttack: true })),
        ...bonusActionSpells.map(s => ({ ...s, _isAttack: false })),
        ...(isHordeBreakerAvailable && hordeBreakerAttack ? [{ ...hordeBreakerAttack, _isAttack: true }] : []),
    ];

    const sortedBonusItems = allBonusItems.sort((a, b) => {
        const levelA = a._isAttack ? getAttackSpellLevel(a.name) : a.level;
        const levelB = b._isAttack ? getAttackSpellLevel(b.name) : b.level;
        if (levelA != null && levelB != null) {
            if (levelA !== levelB) return levelA - levelB;
            return a.name.localeCompare(b.name);
        }
        if (levelA == null && levelB == null) return a.name.localeCompare(b.name);
        if (levelA == null) return -1;
        return 1;
    });

    const useFullGrid = bonusActionAttacks.length > 0;

    return (
         <div>
             <hr />
             <div className='sectionHeader'>Bonus Actions</div>
             {bonusActionAttacks.length > 0 || bonusActionSpells.length > 0 ? (
                 <div className={`attacks ${is2024Rules ? 'mastery-enabled' : ''}`}>
                   <div className='left'><b>Name</b></div>
                       <div><b>Level</b></div>
                       <div><b>Range</b></div>
                       {useFullGrid && <div><b>Hit</b></div>}
                       {useFullGrid && <div><b>Damage</b></div>}
                       <div className='left'><b>Type</b></div>
                       {is2024Rules && useFullGrid && <div><b>Mastery</b></div>}
                        {sortedBonusItems.map((item) => {
                            if (item._isAttack) {
                                const attackLevel = getAttackSpellLevel(item.name);
                                const attackItem = { ...item };
                                delete attackItem._isAttack;
                                return <React.Fragment key={item.name}>
                                    <div className='left'>{item.name}</div>
                                    <div>{attackLevel != null ? (attackLevel === 0 ? 'Cantrip' : attackLevel) : '-'}</div>
                                    <div>{formatRange(item.range)}</div>
                                    {item.saveDc
                                       ? <div className="save-dc-display">DC {item.saveDc + displaySaveDcBonus} {item.saveType}</div>
                                     : <div className={"clickable" + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? " stat--penalized" : "") + (cannotAct ? " disabled-attack" : "")} onClick={() => onAttackClick(attackItem)}>{signFormatter.format(item.hitBonus - exhaustionPenalty)}</div>}
                                   <div className={item.damage ? "clickable" : ""} onClick={() => {
                                       if (cannotAct) return;
                                       if (item.saveDc) { onResolveSpellDamage(attackItem); return; }
                                       // To-Hit attacks: damage is ALWAYS rolled through the "To Hit" flow.
                                       // Direct damage click only logs a simple die roll — no targeting, no riders.
                                       handleSimpleDamageRoll(attackItem);
                                   }}>{item.damage}</div>
                                  <div className='left'>{item.damageType}</div>
                                   {is2024Rules && (() => { const mastery = getWeaponMastery(item.name, item); return <div className={mastery ? "clickable" : ""} onClick={() => { if (mastery) showWeaponMasteryPopup(mastery, setPopupHtml); }}>{mastery}</div>; })()}
                              </React.Fragment>;
                           } else {
                               return <React.Fragment key={item.name}>
                                    <div className='left clickable' onClick={() => handleBonusSpellClick(item.name)}>{item.name}</div>
                                    <div>{item.level === 0 ? 'Cantrip' : item.level}</div>
                                    <div>{item.range}</div>
                                    {useFullGrid && <div>-</div>}
                                    {useFullGrid && <div>Utility</div>}
                                    <div className='left'></div>
                                    {is2024Rules && useFullGrid && <div></div>}
                               </React.Fragment>;
                           }
                       })}
                     <div className='half-line'></div>
                 </div>
              ) : null}
              {selectedBonusSpell && (
                 <Popup onClickOrKeyDown={() => setSelectedBonusSpell(null)}>
                     <SpellDetailPopup
                        spell={selectedBonusSpell}
                        playerStats={playerStats}
                        campaignName={campaignName}
                        playerLevel={playerStats.level}
                        upcastLevels={buildUpcastLevels(selectedBonusSpell)}
                        onClose={() => setSelectedBonusSpell(null)}
                         onCast={handleBonusSpellCast}
                     />
                 </Popup>
             )}
                {pendingMetamagic && (
                   <div>
                       <MetamagicPopup
                         spell={{ name: pendingMetamagic.spellName, level: pendingMetamagic.spellLevel || 0 }}
                         playerStats={{ ...playerStats, _metamagicCurrentSP: pendingMetamagic._currentSP }}
                         campaignName={campaignName}
                         onConfirm={handleConfirm}
                         onSkip={handleSkip}
                      />
                  </div>
              )}
             {(popupHtml && hasBonusActions) && <br />}
              {hasBonusActions && <div>
              {((playerStats.bonusActions || []).filter(a => getCategories(playerStats.rules || '5e').featuresToIgnore.includes(a.name) === false)).map((bonusAction) => {
                     const isBonusClickable = bonusAction.details || hasAutomation(bonusAction);
                     const bonusAuto = bonusAction.automation;
                     const isRageExpendable = bonusAuto?.recharge === 'long_rest_or_expend_rage';
                     const exhausted = isRageExpendable && isExhausted(bonusAction, playerStats, campaignName);
                     const handleRestoreRage = async () => {
                         const rageKey = bonusAuto.resourceKey || (bonusAction.name.toLowerCase().replace(/\s+/g, '') + 'Uses');
                         const currentRage = Number(getRuntimeValue(playerStats.name, 'ragePoints', campaignName) ?? 0);
                         if (currentRage <= 0) {
                             setPopupHtml(`<b>${bonusAction.name}</b><br/>No Rage remaining to restore this feature.`);
                             return;
                         }
                         await setRuntimeValue(playerStats.name, 'ragePoints', currentRage - 1, campaignName);
                         await setRuntimeValue(playerStats.name, rageKey, 0, campaignName);
                         setPopupHtml(`<b>${bonusAction.name}</b><br/>Expended 1 Rage to restore use.`);
                         window.dispatchEvent(new CustomEvent('combat-summary-updated'));
                     };
                     const handleBonusClick = () => {
                         if (exhausted) return;
                         if (hasAutomation(bonusAction)) {
                             onAutomationAction(bonusAction);
                          } else {
                             setPopupHtml(buildFeatureDetailHtml(bonusAction));
                          }
                      };
                     return <div key={bonusAction.name}>
                          <b className={isBonusClickable && !exhausted ? "clickable" : ""} onClick={handleBonusClick}>{bonusAction.name}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(bonusAction.description) }}></span>
                          {hasAutomation(bonusAction) && bonusAction.automation?.type === 'healing_pool' && <span className="automation-badge"> Pool: {bonusAction.automation.pool} HP</span>}
                          {hasAutomation(bonusAction) && bonusAction.automation?.damage && <span className="automation-badge"> {bonusAction.automation.damage} {bonusAction.automation.damageType}</span>}
                          {exhausted && isRageExpendable && <span className="automation-badge clickable" onClick={handleRestoreRage}><i className="fa-solid fa-fire-flame-curved"></i> Restore with Rage</span>}
                      </div>
                  })}
             </div>}
         </div>
     );
}

export default CharBonusActions
