import React, { useState } from 'react'
import Popup from '../common/Popup.jsx'
import DiceRollResult from './DiceRollResult.jsx'
import MetamagicPopup from './MetamagicPopup.jsx'
import SpellDetailPopup from './char-spells/SpellDetailPopup.jsx'
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { showWeaponMasteryPopup, buildFeatureDetailHtml } from '../../hooks/useActionPopup.js'
import { hasAutomation } from '../../services/combat/automationService.js'
import { isExhausted } from '../../services/automation/handlers/combat/saveAttackHandler.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js'
import { useSpellMetamagicFlow } from '../../hooks/useSpellMetamagicFlow.js'
import { useSpellUpcastFlow } from '../../hooks/useSpellUpcastFlow.js'
import { executeSpellCast } from '../../services/rules/spells/spellCastService.js'
import { getCurrentCombatRound } from '../../services/encounters/combatData.js'
import * as mapsService from '../../services/maps/mapsService.js';
import { getNearestPlacedItem } from '../../services/rules/combat/rangeValidation.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getInnateSorceryBonus } from '../../services/combat/buffService.js';
import './CharActions.css'

const signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });
const bonusActionCastingTimes = ['1 bonus action', '1 Bonus Action', 'bonus action', 'Bonus Action'];
const actionCastingTimes = ['1 action', '1 Action', 'action', 'Action'];

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

function CharBonusActions({ playerStats, campaignName, exhaustionPenalty, conditionAttackMode, cannotAct, mapName, onAttackClick, onDamageClick, onAutomationAction, getWeaponMastery, rollAttack, rollDamage, getTargetInfo }) {
    const [popupHtml, setPopupHtml] = useState(null);
    const [selectedBonusSpell, setSelectedBonusSpell] = useState(null);

    const { saveDcBonus: displaySaveDcBonus } = getInnateSorceryBonus(playerStats.name, campaignName);

    const is2024Rules = playerStats.rules === '2024';

    const handleBonusSpellClick = (spellName) => {
        const spell = bonusSpellNames[spellName];
        if (!spell) return;
        setSelectedBonusSpell(spell);
     };

    const cachedBonusCastPosRef = React.useRef(null);

    const bonusCastAction = React.useCallback((spell, metaCtx) => {
      const pos = cachedBonusCastPosRef.current;
      executeSpellCast(spell, metaCtx, { rollAttack, rollDamage, playerStats, getTargetInfo, attackerPos: pos?.attackerPos, targetPos: pos?.targetPos, innateSorceryActive: !!displaySaveDcBonus, campaignName, mapName });
      cachedBonusCastPosRef.current = null;
      }, [rollAttack, rollDamage, playerStats, getTargetInfo, displaySaveDcBonus, campaignName, mapName]);
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

    const handleBonusSpellCast = React.useCallback(async (spell) => {
      setSelectedBonusSpell(null);

      await resolveBonusSpellPositions();
      gateMetamagic(spell);
    }, [gateMetamagic, resolveBonusSpellPositions]);

    const bonusActionAttacks = playerStats.attacks.filter((attack) => {
        if (attack.type !== 'Bonus Action') return false;
        // Filter out Horde Breaker placeholder — UI will show it conditionally
        if (attack.isHordeBreaker) return false;
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
    const useFullGrid = bonusActionAttacks.length > 0;

    return (
         <div>
             <hr />
             <div className='sectionHeader'>Bonus Actions</div>
             {bonusActionAttacks.length > 0 || bonusActionSpells.length > 0 ? (
                 <div className={`attacks ${is2024Rules ? 'mastery-enabled' : ''}`}>
                     <div className='left'><b>Name</b></div>
                     <div><b>Range</b></div>
                     {useFullGrid && <div><b>Hit</b></div>}
                     {useFullGrid && <div><b>Damage</b></div>}
                     <div className='left'><b>Type</b></div>
                     {is2024Rules && useFullGrid && <div><b>Mastery</b></div>}
                      {bonusActionAttacks.map((attack) => {
                         return <React.Fragment key={attack.name}>
                              <div className='left'>{attack.name}</div>
                              <div>{attack.range} ft.</div>
                                {attack.saveDc
                                    ? <div className="save-dc-display">DC {attack.saveDc + displaySaveDcBonus} {attack.saveType}</div>
                                  : <div className={"clickable" + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? " stat--penalized" : "") + (cannotAct ? " disabled-attack" : "")} onClick={() => onAttackClick(attack)}>{signFormatter.format(attack.hitBonus - exhaustionPenalty)}</div>}
                              <div className={attack.damage ? "clickable" : ""} onClick={() => !cannotAct && onDamageClick(attack)}>{attack.damage}</div>
                              <div className='left'>{attack.damageType}</div>
                              {is2024Rules && <div className={getWeaponMastery(attack.name) ? "clickable" : ""} onClick={() => { const mastery = getWeaponMastery(attack.name); if (mastery) showWeaponMasteryPopup(mastery, setPopupHtml); }}>{getWeaponMastery(attack.name) || ''}</div>}
                          </React.Fragment>;
                      })}
                      {/* Horde Breaker bonus action attack (only shown when Hunter's Prey choice is Horde Breaker) */}
                      {isHordeBreakerAvailable && hordeBreakerAttack && (
                          <React.Fragment>
                              <div className='left'>Horde Breaker</div>
                              <div>{hordeBreakerAttack.range} ft.</div>
                              <div className={"clickable" + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' ? " stat--penalized" : "")} onClick={() => onAttackClick(hordeBreakerAttack)}>{signFormatter.format(hordeBreakerAttack.hitBonus - exhaustionPenalty)}</div>
                              <div className={hordeBreakerAttack.damage ? "clickable" : ""} onClick={() => !cannotAct && onDamageClick(hordeBreakerAttack)}>{hordeBreakerAttack.damage}</div>
                              <div className='left'>{hordeBreakerAttack.damageType}</div>
                              {is2024Rules && <div></div>}
                          </React.Fragment>
                      )}
                     {bonusActionSpells.map((spell) => {
                        return <React.Fragment key={spell.name}>
                             <div className='left clickable' onClick={() => handleBonusSpellClick(spell.name)}>{spell.name}</div>
                             <div>{spell.range}</div>
                             {useFullGrid && <div>-</div>}
                             {useFullGrid && <div>Utility</div>}
                             <div className='left'>Utility</div>
                             {is2024Rules && useFullGrid && <div></div>}
                         </React.Fragment>;
                     })}
                     <div className='half-line'></div>
                 </div>
             ) : null}
             {popupHtml && (
                 <Popup onClickOrKeyDown={() => setPopupHtml(null)}>
                     {typeof popupHtml === 'string' ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml) }}></div> :
                        popupHtml.type === 'automation_info' ? <div className="dice-roll-result"><div className="dice-roll-header"><i className="fa-solid fa-info-circle"></i>{popupHtml.name}</div><div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml.description) }}></div><div className="dice-roll-hint">click to dismiss</div></div> :
                            popupHtml.type === 'empowered_spell' ? <div className="dice-roll-result">
                                 <div className="dice-roll-header"><i className="fa-solid fa-wand-magic-sparkles"></i>{popupHtml.name}</div>
                                 <div className="metamagic-sp-display">Sorcery Points: <strong>{popupHtml.currentSP}</strong> / {popupHtml.maxSP}</div>
                                 {popupHtml.error && <div className="empowered-error" style={{ color: 'var(--stat-penalized, #cc4444)', marginTop: '8px' }}>{popupHtml.error}</div>}
                                 {popupHtml.lastEvent && !popupHtml.completed && popupHtml.lastEvent.rolls && (
                                     <div className="empowered-damage-info" style={{ marginTop: '8px' }}>
                                         <div><strong>Spell:</strong> {popupHtml.lastEvent.spellName}</div>
                                         <div><strong>Target:</strong> {popupHtml.lastEvent.targetName}</div>
                                         <div><strong>Formula:</strong> {popupHtml.lastEvent.damageFormula}</div>
                                         <div><strong>Original Damage:</strong> {popupHtml.lastEvent.rawDamage}</div>
                                         <div><strong>CHA Modifier:</strong> {popupHtml.chaMod} - can reroll up to {popupHtml.chaMod} dice</div>
                                     </div>
                                 )}
                                 {popupHtml.completed && popupHtml.result && (
                                     <div className="empowered-result" style={{ marginTop: '8px' }}>
                                         <hr />
                                         {popupHtml.result.message ? (
                                             <div>{popupHtml.result.message}</div>
                                         ) : (
                                             <>
                                                 <div><strong>Original Damage:</strong> {popupHtml.result.oldTotal}</div>
                                                 <div><strong>New Damage:</strong> {popupHtml.result.newTotal}</div>
                                                 <div><strong>Difference:</strong> {popupHtml.result.damageDifference > 0 ? '+' : ''}{popupHtml.result.damageDifference}</div>
                                             </>
                                         )}
                                     </div>
                                 )}
                             </div> :
                             <DiceRollResult {...popupHtml} />}
                 </Popup>
             )}
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
             {playerStats.bonusActions.map((bonusAction) => {
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
