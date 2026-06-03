import React, { useState } from 'react'
import Popup from '../common/Popup.jsx'
import DiceRollResult from './DiceRollResult.jsx'
import MetamagicPopup from './MetamagicPopup.jsx'
import SpellDetailPopup from './char-spells/SpellDetailPopup.jsx'
import { sanitizeHtml } from '../../services/sanitize.js';
import { showWeaponMasteryPopup, buildFeatureDetailHtml } from '../../hooks/useActionPopup.js'
import { hasAutomation } from '../../services/automationService.js'
import { useSpellMetamagicFlow } from '../../hooks/useSpellMetamagicFlow.js'
import { executeSpellCast } from '../../services/spellCastService.js'
import './CharActions.css'

const signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });
const bonusActionCastingTimes = ['1 bonus action', '1 Bonus Action', 'bonus action', 'Bonus Action'];

function CharBonusActions({ playerStats, campaignName, exhaustionPenalty, conditionAttackMode, cannotAct, mapName, onAttackClick, onDamageClick, onAutomationAction, getWeaponMastery, rollAttack, rollDamage, getCombatTargetInfo }) {
    const [popupHtml, setPopupHtml] = useState(null);
    const [selectedBonusSpell, setSelectedBonusSpell] = useState(null);

    const is2024Rules = playerStats.rules === '2024';

    const handleBonusSpellClick = (spellName) => {
        const spell = bonusSpellNames[spellName];
        if (!spell) return;
        setSelectedBonusSpell(spell);
     };

    const bonusCastAction = React.useCallback((spell, metaCtx) => {
      executeSpellCast(spell, metaCtx, { rollAttack, rollDamage, playerStats, getCombatTargetInfo });
    }, [rollAttack, rollDamage, playerStats, getCombatTargetInfo]);
    const { pendingMetamagic, gateMetamagic, handleConfirm, handleSkip } = useSpellMetamagicFlow(playerStats, campaignName, bonusCastAction);
    const handleBonusSpellCast = React.useCallback((spell) => {
      setSelectedBonusSpell(null);
      gateMetamagic(spell);
    }, [gateMetamagic]);

    const bonusActionAttacks = playerStats.attacks.filter((attack) => attack.type === 'Bonus Action');
    const attackNames = new Set((playerStats.attacks || []).map(a => a.name));
    const bonusActionSpells = playerStats.spellAbilities?.spells?.filter(spell =>
        bonusActionCastingTimes.includes(spell.casting_time) &&
         (spell.prepared === 'Always' || spell.prepared === 'Prepared') &&
         !attackNames.has(spell.name)
     ) || [];
    const hasBonusActions = playerStats.bonusActions.length > 0;
    const hasBonusContent = bonusActionSpells.length > 0 || bonusActionAttacks.length > 0 || hasBonusActions;

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
                                 ? <div className="save-dc-display">DC {attack.saveDc} {attack.saveType}</div>
                                 : <div className={"clickable" + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? " stat--penalized" : "") + (cannotAct ? " disabled-attack" : "")} onClick={() => onAttackClick(attack)}>{signFormatter.format(attack.hitBonus - exhaustionPenalty)}</div>}
                             <div className={attack.damage ? "clickable" : ""} onClick={() => !cannotAct && onDamageClick(attack)}>{attack.damage}</div>
                             <div className='left'>{attack.damageType}</div>
                             {is2024Rules && <div className={getWeaponMastery(attack.name) ? "clickable" : ""} onClick={() => { const mastery = getWeaponMastery(attack.name); if (mastery) showWeaponMasteryPopup(mastery, setPopupHtml); }}>{getWeaponMastery(attack.name) || ''}</div>}
                         </React.Fragment>;
                     })}
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
                                 <div className="metamagic-sp-display">Sorcery Points: <strong>{popupHtml.currentSP}</strong> / {popupHtml.lastEvent ? popupHtml.lastEvent.maxSP : '?'}</div>
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
                    const handleBonusClick = () => {
                        if (hasAutomation(bonusAction)) {
                            onAutomationAction(bonusAction);
                         } else {
                            setPopupHtml(buildFeatureDetailHtml(bonusAction));
                         }
                     };
                    return <div key={bonusAction.name}>
                         <b className={isBonusClickable ? "clickable" : ""} onClick={handleBonusClick}>{bonusAction.name}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(bonusAction.description) }}></span>
                         {hasAutomation(bonusAction) && bonusAction.automation?.type === 'healing_pool' && <span className="automation-badge"> Pool: {bonusAction.automation.pool} HP</span>}
                         {hasAutomation(bonusAction) && bonusAction.automation?.damage && <span className="automation-badge"> {bonusAction.automation.damage} {bonusAction.automation.damageType}</span>}
                     </div>
                 })}
             </div>}
         </div>
     );
}

export default CharBonusActions
