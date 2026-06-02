import React, { useState, useCallback } from 'react'
import Popup from '../common/Popup.jsx'
import DiceRollResult from './DiceRollResult.jsx'
import MetamagicPopup from './MetamagicPopup.jsx'
import SpellDetailPopup from './char-spells/SpellDetailPopup.jsx'
import { sanitizeHtml } from '../../services/sanitize.js';
import { addEntry } from '../../services/logService.js';
import { getCurrentSorceryPoints, getMaxSorceryPoints, spendSorceryPoints } from '../../hooks/useMetamagic.js';
import { showWeaponMasteryPopup, buildFeatureDetailHtml } from '../../hooks/useActionPopup.js'
import { hasAutomation } from '../../services/automationService.js'
import './CharActions.css'

const signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });
const bonusActionCastingTimes = ['1 bonus action', '1 Bonus Action', 'bonus action', 'Bonus Action'];

function CharBonusActions({ playerStats, campaignName, exhaustionPenalty, conditionAttackMode, cannotAct, mapName, onAttackClick, onDamageClick, onAutomationAction, getWeaponMastery }) {
    const [popupHtml, setPopupHtml] = useState(null);
    const [selectedBonusSpell, setSelectedBonusSpell] = useState(null);
    const [bonusPendingMetamagic, setBonusPendingMetamagic] = useState(null);

    const is2024Rules = playerStats.rules === '2024';

    const handleBonusSpellClick = (spellName) => {
        const spell = bonusSpellNames[spellName];
        if (!spell) return;
        setSelectedBonusSpell(spell);
     };

    const handleBonusSpellsSelectMeta = (spell) => {
        setSelectedBonusSpell(null);

        const isBonusSorcerer = playerStats.class?.name === 'Sorcerer';
        if (!isBonusSorcerer) {
            addEntry(campaignName, {
                type: 'spell',
                characterName: playerStats.name,
                spellName: spell.name,
                spellLevel: spell.level || 0,
                castingTime: spell.casting_time,
                metamagic: [],
                spCost: 0,
                timestamp: Date.now(),
             });
            return;
         }

        const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));
        setBonusPendingMetamagic({
            spellName: spell.name,
            spellLevel: spell.level || 0,
             _currentSP: currentSP,
            castingTime: spell.casting_time,
         });
     };

    const handleBonusMetamagicConfirm = useCallback((result) => {
        if (result && result.totalCost && result.totalCost > 0) {
            spendSorceryPoints(playerStats.name, result.totalCost, campaignName);
         }
        addEntry(campaignName, {
            type: 'spell',
            characterName: playerStats.name,
            spellName: bonusPendingMetamagic.spellName,
            spellLevel: bonusPendingMetamagic.spellLevel || 0,
            castingTime: bonusPendingMetamagic.castingTime,
            metamagic: result ? (result.options || []) : [],
            spCost: result ? (result.totalCost || 0) : 0,
            timestamp: Date.now(),
         });
        setBonusPendingMetamagic(null);
     }, [playerStats.name, campaignName, bonusPendingMetamagic]);

    const handleBonusMetamagicSkip = useCallback(() => {
        addEntry(campaignName, {
            type: 'spell',
            characterName: playerStats.name,
            spellName: bonusPendingMetamagic.spellName,
            spellLevel: bonusPendingMetamagic.spellLevel || 0,
            castingTime: bonusPendingMetamagic.castingTime,
            metamagic: [],
            spCost: 0,
            timestamp: Date.now(),
         });
        setBonusPendingMetamagic(null);
     }, [playerStats.name, campaignName, bonusPendingMetamagic]);

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
                        onCast={(spell) => { handleBonusSpellsSelectMeta(spell); }}
                     />
                 </Popup>
             )}
             {bonusPendingMetamagic && (
                 <div>
                     <MetamagicPopup
                        spell={{ name: bonusPendingMetamagic.spellName, level: bonusPendingMetamagic.spellLevel || 0 }}
                        playerStats={{ ...playerStats, _metamagicCurrentSP: bonusPendingMetamagic._currentSP }}
                        campaignName={campaignName}
                        onConfirm={handleBonusMetamagicConfirm}
                        onSkip={handleBonusMetamagicSkip}
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
