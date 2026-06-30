import React, { useState } from 'react'
import Popup from '../common/popup.jsx'
import MetamagicPopup from './popups/MetamagicPopup.jsx'
import SpellDetailPopup from './char-spells/SpellDetailPopup.jsx'
import { getCategories } from '../../services/character/featureCategories.js'
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { getBonusActionSpellNames } from '../../services/ui/spellSectionUtils.js'
import { showWeaponMasteryPopup, buildFeatureDetailHtml } from '../../hooks/combat/useActionPopup.js'
import { hasAutomation } from '../../services/combat/automation/automationService.js'
import { isExhausted } from '../../services/automation/handlers/combat/saveAttackHandler.js'
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { useSpellMetamagicFlow } from '../../hooks/combat/useSpellMetamagicFlow.js'
import { useSpellUpcastFlow } from '../../hooks/combat/useSpellUpcastFlow.js'
import { getCurrentCombatRound } from '../../services/encounters/combatData.js'
import { getInnateSorceryBonus } from '../../services/combat/buffs/buffService.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';
import { formatRange, signFormatter, getAttackSpellLevel } from '../../services/ui/formatUtils.js';
import { resolveSpellDamageAtLevel } from '../../services/rules/core/attackCalc.js';
import { useSimpleDamageRoll } from '../../hooks/combat/useSimpleDamageRoll.js';
import { useSpellPositionResolver } from '../../hooks/combat/useSpellPositionResolver.js';
import { useSpellCastExecutor } from '../../hooks/combat/useSpellCastExecutor.js';
import { handleRestoreRage } from '../../services/character/rageUtils.js';
import './CharActions.css'

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

    const handleSimpleDamageRoll = useSimpleDamageRoll(playerStats.name, campaignName, popupHtml, setPopupHtml);

    const { resolvePositions: resolveBonusSpellPositions, cachedPosRef: cachedBonusCastPosRef } = useSpellPositionResolver(campaignName, mapName, playerStats.name);

    const { castAction: bonusCastAction } = useSpellCastExecutor(rollAttack, rollDamage, playerStats, getTargetInfo, campaignName, mapName, characters, setPopupHtml, { innateSorceryActive: !!displaySaveDcBonus }, cachedBonusCastPosRef);

    const { pendingMetamagic, gateMetamagic, handleConfirm, handleSkip } = useSpellMetamagicFlow(playerStats, campaignName, bonusCastAction);
    const { buildUpcastLevels } = useSpellUpcastFlow(playerStats, campaignName);

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
    const bonusSpellNameSet = getBonusActionSpellNames(playerStats, campaignName);
    const bonusActionSpells = (playerStats.spellAbilities?.spells || []).filter(spell => bonusSpellNameSet.has(spell.name));
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

    return (
         <div className='char-actions'>
             <div className='sectionHeader'>Bonus Actions</div>
               {(bonusActionAttacks.length > 0 || bonusActionSpells.length > 0 || isHordeBreakerAvailable) ? (
                  <div className={`attacks ${is2024Rules ? 'mastery-enabled' : ''}`}>
                    <div className='left'><b>Name</b></div>
                        <div><b>Level</b></div>
                        <div><b>Range</b></div>
                        <div><b>Hit</b></div>
                        <div><b>Damage</b></div>
                        <div className='left'><b>Type</b></div>
                        {is2024Rules && <div><b>Mastery</b></div>}
                        {bonusActionAttacks.map((attack) => {
                            const attackLevel = getAttackSpellLevel(playerStats.spellAbilities, attack.name);
                            const attackItem = { ...attack };
                            return <React.Fragment key={attack.name}>
                                <div className='left'>{attack.name}</div>
                                <div>{attackLevel != null ? (attackLevel === 0 ? 'Cantrip' : attackLevel) : '-'}</div>
                                <div>{formatRange(attack.range)}</div>
                                {attack.saveDc
                                   ? <div className="save-dc-display">DC {attack.saveDc + displaySaveDcBonus} {attack.saveType}</div>
                                 : <div className={"clickable" + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? " stat--penalized" : "") + (cannotAct ? " disabled-attack" : "")} onClick={() => onAttackClick(attackItem)}>{signFormatter.format(attack.hitBonus - exhaustionPenalty)}</div>}
                               <div className={attack.damage ? "clickable" : ""} onClick={() => {
                                   if (cannotAct) return;
                                   if (attack.saveDc) { onResolveSpellDamage(attackItem); return; }
                                   handleSimpleDamageRoll(attackItem);
                               }}>{attack.damage}</div>
                              <div className='left'>{attack.damageType}</div>
                               {is2024Rules && (() => { const mastery = getWeaponMastery(attack.name, attack, playerStats); return <div className={mastery ? "clickable" : ""} onClick={() => { if (mastery) showWeaponMasteryPopup(mastery, setPopupHtml); }}>{mastery}</div>; })()}
                         </React.Fragment>;
                        })}
                        {isHordeBreakerAvailable && hordeBreakerAttack ? (() => {
                            const hbItem = { ...hordeBreakerAttack };
                            return <React.Fragment key="Horde Breaker">
                                <div className='left'>{hordeBreakerAttack.name}</div>
                                <div>-</div>
                                <div>{formatRange(hordeBreakerAttack.range)}</div>
                                <div className={"clickable" + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? " stat--penalized" : "") + (cannotAct ? " disabled-attack" : "")} onClick={() => onAttackClick(hbItem)}>{signFormatter.format(hordeBreakerAttack.hitBonus - exhaustionPenalty)}</div>
                                <div className={hordeBreakerAttack.damage ? "clickable" : ""} onClick={() => {
                                    if (cannotAct) return;
                                    handleSimpleDamageRoll(hbItem);
                                }}>{hordeBreakerAttack.damage}</div>
                                <div className='left'>{hordeBreakerAttack.damageType}</div>
                                {is2024Rules && <div></div>}
                            </React.Fragment>;
                        })() : null}
                        {bonusActionSpells.map((spell) => {
                            const damageType = typeof spell.damage === 'string' ? '' : (spell.damage?.damage_type || '');
                            const resolvedDamage = spell.heal_at_slot_level ? '' : resolveSpellDamageAtLevel(spell, playerStats.level);
                            const isSpellAtk = !spell.dc;
                            const attackItem = { ...spell, type: 'Bonus Action', hitBonus: playerStats.spellAbilities?.toHit, saveDc: spell.dc ? playerStats.spellAbilities.saveDc : null, saveType: spell.dc?.dc_type, saveSuccess: spell.dc?.dc_success, damage: resolvedDamage, damageType };
                            return <React.Fragment key={spell.name}>
                                <div className='left clickable' onClick={() => handleBonusSpellClick(spell.name)}>{spell.name}</div>
                                <div>{spell.level === 0 ? 'Cantrip' : spell.level}</div>
                                <div>{formatRange(spell.range)}</div>
                                {isSpellAtk
                                    ? <div className={"clickable" + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? " stat--penalized" : "") + (cannotAct ? " disabled-attack" : "")} onClick={() => onAttackClick(attackItem)}>{signFormatter.format(playerStats.spellAbilities?.toHit - exhaustionPenalty)}</div>
                                    : <div className="save-dc-display">DC {playerStats.spellAbilities?.saveDc + displaySaveDcBonus} {spell.dc?.dc_type}</div>}
                                <div className={resolvedDamage ? "clickable" : ""} onClick={() => {
                                    if (cannotAct) return;
                                    if (isSpellAtk && spell.saveDc) { onResolveSpellDamage(attackItem); return; }
                                    handleSimpleDamageRoll(attackItem);
                                }}>{resolvedDamage}</div>
                                <div className='left'>{damageType || (spell.heal_at_slot_level ? 'Healing' : 'Utility')}</div>
                                {is2024Rules && <div></div>}
                           </React.Fragment>;
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
                      const restoreRage = async () => {
                          await handleRestoreRage(playerStats, campaignName, bonusAction.name, bonusAuto, setPopupHtml);
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
                           {exhausted && isRageExpendable && <span className="automation-badge clickable" onClick={restoreRage}><i className="fa-solid fa-fire-flame-curved"></i> Restore with Rage</span>}
                      </div>
                  })}
             </div>}
         </div>
     );
}

export default CharBonusActions
