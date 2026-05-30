
import React from 'react'
import { cloneDeep } from 'lodash';
import useActionPopup from '../../../hooks/useActionPopup.js'
import useLoggedDiceRoll from '../../../hooks/useLoggedDiceRoll.js'
import Popup from '../../common/Popup.jsx'
import DiceRollResult from '../DiceRollResult.jsx'
import CharSpellSlots from './CharSpellSlots.jsx'
import { rollExpression } from '../../../services/diceRoller.js';
import { sanitizeHtml } from '../../../services/sanitize.js';
import { getCombatContext, getTargetFromAttacker, getAttackerTargetId } from '../../../services/damageUtils.js';
import './CharSpells.css'

const CharSpells = function CharSpells({ playerStats, handleTogglePreparedSpells, campaignName, exhaustionPenalty = 0, conditionAttackMode, cannotAct }) {
    const { showPopup, popupHtml, setPopupHtml } = useActionPopup('spell');
    const { popupHtml: dicePopupHtml, setPopupHtml: setDicePopupHtml, rollAttack, rollDamage, quickRollPlayerSave } = useLoggedDiceRoll(playerStats.name, campaignName);

    const getDamageFormula = (effect) => {
        const match = effect.match(/^(\d+d\d+(?:[+-]\d+)?)/);
        return match ? match[1] : null;
    };

    const getCombatTargetInfo = React.useCallback(() => {
        const cs = getCombatContext();
        if (!cs) return null;
        return getTargetFromAttacker(cs, playerStats.name);
    }, [playerStats.name]);

    const handleDamageRoll = (formula, spellName, spell) => {
        const result = rollExpression(formula);
        if (result) {
            const target = getCombatTargetInfo();
            const cs = getCombatContext();
            const rawTargetId = getAttackerTargetId(cs, playerStats.name);
            const context = {
                targetId: rawTargetId || target?.id,
                targetName: target?.name,
                attackerName: playerStats.name,
            };
            if (spell.dc) {
                context.dc = playerStats.spellAbilities.saveDc;
                context.dcType = spell.dc.dc_type;
                context.dcSuccess = spell.dc.dc_success;
                context.saveDc = playerStats.spellAbilities.saveDc;
                context.saveType = spell.dc.dc_type;
                context.dcSuccess = spell.dc.dc_success;
            }
            rollDamage(spellName, formula, result.total, result.rolls, result.modifier, context);
        }
    };
    const [filterPrepared, setFilterPrepared] = React.useState(false);
    const [spells, setSpells] = React.useState([]);
    const is2024 = playerStats.rules === '2024';
    React.useEffect(() => {
        if(playerStats.spellAbilities) {
            setFilterPrepared(false);
            setSpells(playerStats.spellAbilities.spells);
          }
      }, [playerStats]);
    const handleTogglePreparedFilter = () => {
        const spells = cloneDeep(playerStats.spellAbilities.spells);
        if(!filterPrepared) {
            setSpells(spells.filter(spell => spell.prepared === 'Always' || spell.prepared === 'Prepared'));
        } else {
            setSpells(spells)
        }
        setFilterPrepared(!filterPrepared)
    }
    const handleSortLevel = () => {
        const spells = cloneDeep(playerStats.spellAbilities.spells);
        // Sort by level (ascending) then by name
        spells.sort((a, b) => {
            if (a.level !== b.level) {
                return a.level - b.level;
            } else {
                return a.name.localeCompare(b.name);
              }
          });
        setSpells(spells);
    }
    const handleSortSpell = () => {
        const spells = cloneDeep(playerStats.spellAbilities.spells);
        spells.sort((a, b) => a.name.localeCompare(b.name));
        setSpells(spells);
    }
    return (
        <div className="char-spells">
            {(playerStats.spellAbilities && playerStats.spellAbilities.spells.length > 0) && <div className="spell-popup-parent">
                    {popupHtml && (
                        <Popup onClickOrKeyDown={() => setPopupHtml && setPopupHtml(null)}>
                            {typeof popupHtml === 'string' ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml) }}></div> : 
                             <DiceRollResult {...popupHtml} />}
                        </Popup>
                    )}
                    {dicePopupHtml && (
                        <Popup onClickOrKeyDown={() => setDicePopupHtml && setDicePopupHtml(null)}>
                            {typeof dicePopupHtml === 'string' ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(dicePopupHtml) }}></div> : 
                             <DiceRollResult {...dicePopupHtml} onQuickRoll={dicePopupHtml.waitingForPlayerSave ? () => quickRollPlayerSave(dicePopupHtml.promptId, dicePopupHtml.targetName, dicePopupHtml.saveType, dicePopupHtml.saveDc) : undefined} />}
                        </Popup>
                    )}
            <hr />
            <div className='spell-abilities'>
                <div className="sectionHeader"><h4>&nbsp;Spells</h4></div>
                <div>
                    <b className={'clickable' + (cannotAct ? ' disabled-attack' : '') + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? ' stat--penalized' : '')} onClick={() => !cannotAct && rollAttack('Spell Attack', playerStats.spellAbilities.toHit - exhaustionPenalty, { forcedMode: conditionAttackMode !== 'normal' ? conditionAttackMode : undefined })}>Attack (to hit):</b> <span className={exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? 'stat--penalized' : ''}>+{playerStats.spellAbilities.toHit - exhaustionPenalty}</span><br/>
                    <b>Modifier:</b> <span className={exhaustionPenalty > 0 ? 'stat--penalized' : ''}>+{playerStats.spellAbilities.modifier - exhaustionPenalty}</span><br/>
                    <b>Save DC:</b> {playerStats.spellAbilities.saveDc}
                </div>
                <div>
                    <b>Cantrips Known:</b> {playerStats.spellAbilities.cantrips_known ? playerStats.spellAbilities.cantrips_known : 0}<br/>
                    {!is2024 && <div>
                        <b>Prepared Spells:</b> {playerStats.spellAbilities.prepared_spells || playerStats.spellAbilities.spells_known ? (playerStats.spellAbilities.prepared_spells || playerStats.spellAbilities.spells_known) : 'All'}<br/>                    
                        <b>Max Prepared:</b> {playerStats.spellAbilities.maxPreparedSpells ? playerStats.spellAbilities.maxPreparedSpells : 'All'}
                    </div>}
                </div>
                <CharSpellSlots playerStats={playerStats} campaignName={campaignName}></CharSpellSlots>
            </div>
            <table className='table-spells table-striped'>
                <thead>
                    <tr>
                        <th className='left clickable' onClick={handleSortSpell}>Spell</th>
                        <th className='clickable' onClick={handleSortLevel}>Level</th>
                        {!is2024 && <th className='clickable' onClick={handleTogglePreparedFilter}>Prepared</th>}
                        <th>Time</th>
                        <th>Range</th>
                        <th>Effect</th>
                        <th>Duration</th>
                        <th className='left'>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    {spells.map((spell) => {
                        let notes = [];
                        if(spell.concentration) notes.push('Concentration');
                        if(spell.ritual) notes.push('Ritual');
                        if(spell.components) notes.push(spell.components.join('/'));
                        let effect = 'Utility';
                        if(spell.damage) {
                            const slotDmg = spell.damage.damage_at_slot_level;
                            const charDmg = spell.damage.damage_at_character_level;
                            const dmgObj = slotDmg && Object.keys(slotDmg).length ? slotDmg : charDmg;
                            if (dmgObj) {
                                effect = `${dmgObj[Object.keys(dmgObj)[0]]} ${spell.damage.damage_type}`;
                                if (spell.dc) {
                                    const saveLabel = spell.dc.dc_success === 'half' ? 'half' : 'negates';
                                    effect += ` (${spell.dc.dc_type} ${saveLabel})`;
                                }
                            }
                        }
                        return <tr key={spell.name}>
                            <td className='left spell-name clickable' onClick={() => showPopup(spell)}>{spell.name}</td>
                            <td>{spell.level === 0 ? 'Cantrip' : spell.level}</td>
                            {!is2024 && (spell.prepared !== 'Prepared' && spell.prepared !== '') && <td>{spell.prepared}</td>}
                            {!is2024 && (spell.prepared === 'Prepared' || spell.prepared === '') && <td><input tabIndex={0} type="checkbox" checked={spell.prepared === 'Prepared'} onChange={() => handleTogglePreparedSpells(spell.name)}/></td>}
                            <td>{spell.casting_time ? spell.casting_time.replace('reaction','R').replace('bonus action','BA').replace('action',' A').replace('minute','min').replace('minutes','min') : ''}</td>
                            <td>{spell.range}</td>
                            <td className={getDamageFormula(effect) ? 'clickable' : ''} onClick={getDamageFormula(effect) ? () => handleDamageRoll(getDamageFormula(effect), spell.name, spell) : undefined}>{effect}</td>
                            <td>{spell.duration ? spell.duration.replace('Instantaneous','Instant').replace('minute','min').replace('minutes','min') : ''}</td>
                            <td className='left'>{notes.join(', ').replace('Concentration','Con')}</td>
                        </tr>
                    })}
                </tbody>
            </table>
        </div>}
    </div>
    )
};

export default CharSpells
