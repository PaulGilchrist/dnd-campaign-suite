
import React from 'react'
import { cloneDeep } from 'lodash';
import useActionPopup from '../../../hooks/useActionPopup.js'
import useLoggedDiceRoll from '../../../hooks/useLoggedDiceRoll.js'
import { getCurrentSorceryPoints, getMaxSorceryPoints, spendSorceryPoints } from '../../../hooks/useMetamagic.js'
import Popup from '../../common/Popup.jsx'
import DiceRollResult from '../DiceRollResult.jsx'
import MetamagicPopup from '../MetamagicPopup.jsx'
import SpellDetailPopup from './SpellDetailPopup.jsx'
import CharSpellSlots from './CharSpellSlots.jsx'
import { rollExpression, rollExpressionDoubled } from '../../../services/diceRoller.js';
import { sanitizeHtml } from '../../../services/sanitize.js';
import { getCombatContext, getTargetFromAttacker } from '../../../services/damageUtils.js';
import { addEntry } from '../../../services/logService.js';
import './CharSpells.css'

const CharSpells = function CharSpells({ playerStats, handleTogglePreparedSpells, campaignName, exhaustionPenalty = 0, conditionAttackMode, cannotAct }) {
    const { popupHtml, setPopupHtml } = useActionPopup('spell');
     const { popupHtml: dicePopupHtml, setPopupHtml: setDicePopupHtml, rollAttack, rollDamage, quickRollPlayerSave } = useLoggedDiceRoll(playerStats.name, campaignName, {
        autoDamageRoll: (autoDamage, isCrit) => {
          const result = isCrit ? rollExpressionDoubled(autoDamage.formula) : rollExpression(autoDamage.formula);
          if (result) {
            const context = {
              damageType: autoDamage.damageType,
              targetName: autoDamage.targetName,
              attackerName: autoDamage.attackerName,
             };
            if (autoDamage.saveDc) {
               context.saveDc = autoDamage.saveDc;
               context.saveType = autoDamage.saveType;
               context.dcSuccess = autoDamage.dcSuccess;
              }
            rollDamage(autoDamage.name, autoDamage.formula, result.total, result.rolls, result.modifier, context);
            }
           },
         });
    const isSorcerer = playerStats.class?.name === 'Sorcerer';
    const [pendingMetamagic, setPendingMetamagic] = React.useState(null);
    const [selectedSpell, setSelectedSpell] = React.useState(null);

   // When metamagic is confirmed, proceed with the spell cast
  const handleMetamagicConfirm = React.useCallback((result) => {
     const pending = pendingMetamagic;
      setPendingMetamagic(null);
    if (!pending) return;

       // Spend sorcery points
     if (result && result.totalCost && result.totalCost > 0) {
         spendSorceryPoints(playerStats.name, result.totalCost, campaignName);
        }

      addEntry(campaignName, {
          type: 'spell',
         characterName: playerStats.name,
          spellName: pending.spellName,
          spellLevel: pending.spellLevel || 0,
         castingTime: pending.castingTime,
          metamagic: result ? (result.options || []) : [],
          spCost: result ? (result.totalCost || 0) : 0,
          timestamp: Date.now(),
        });

       // Build metamagic context to pass to the roll
     const metaCtx = {};
      if (result && result.options) {
         if (result.options.includes('Heightened Spell')) metaCtx.metamagicHeighten = true;
          if (result.options.includes('Careful Spell')) metaCtx.metamagicCareful = true;
           if (result.options.includes('Twinned Spell') && result.twinTarget) metaCtx.metamagicTwinTarget = result.twinTarget;
         if (result.options.includes('Distant Spell')) metaCtx.metamagicDistant = true;
        }

       // Proceed with the pending action
     pending.action(metaCtx);
   }, [pendingMetamagic, playerStats.name, campaignName]);
  const handleMetamagicSkip = React.useCallback(() => {
     const pending = pendingMetamagic;
      setPendingMetamagic(null);
    if (!pending) return;

    addEntry(campaignName, {
         type: 'spell',
        characterName: playerStats.name,
         spellName: pending.spellName,
         spellLevel: pending.spellLevel || 0,
        castingTime: pending.castingTime,
         metamagic: [],
          spCost: 0,
        timestamp: Date.now(),
       });

    pending.action({});
   }, [pendingMetamagic, playerStats.name, campaignName]);

   // Handle casting a spell from the spell detail popup
  const handleSpellCast = React.useCallback((spell) => {
      setSelectedSpell(null);

     if (!isSorcerer) {
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
      setPendingMetamagic({
         spellName: spell.name,
         castingTime: spell.casting_time,
          _currentSP: currentSP,
         spellLevel: spell.level || 0,
        });
    }, [isSorcerer, playerStats.name, campaignName]);

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
        const wasCrit = dicePopupHtml?.isCrit;
        if (wasCrit && setDicePopupHtml) setDicePopupHtml(null);
        const result = wasCrit ? rollExpressionDoubled(formula) : rollExpression(formula);
        if (result) {
            const doDamage = (metaCtx) => {
                const target = getCombatTargetInfo();
                const context = {
                    targetName: target?.name,
                    attackerName: playerStats.name,
                    ...metaCtx,
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
            };
            if (isSorcerer) {
                const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));
                setPendingMetamagic({
                    spellName,
                    action: doDamage,
                    _currentSP: currentSP,
                });
            } else {
                doDamage({});
            }
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
                    {popupHtml && !selectedSpell && (
                        <Popup onClickOrKeyDown={() => setPopupHtml && setPopupHtml(null)}>
                            {typeof popupHtml === 'string' ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml) }}></div> : 
                             <DiceRollResult {...popupHtml} />}
                        </Popup>
                    )}
                    {selectedSpell && (
                        <Popup onClickOrKeyDown={() => setSelectedSpell(null)}>
                            <SpellDetailPopup
                                spell={selectedSpell}
                                playerStats={playerStats}
                                campaignName={campaignName}
                                onClose={() => setSelectedSpell(null)}
                                onCast={handleSpellCast}
                            />
                        </Popup>
                    )}
                    {dicePopupHtml && (
                        <Popup onClickOrKeyDown={() => setDicePopupHtml && setDicePopupHtml(null)}>
                            {typeof dicePopupHtml === 'string' ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(dicePopupHtml) }}></div> : 
                             <DiceRollResult {...dicePopupHtml} onQuickRoll={dicePopupHtml.waitingForPlayerSave ? () => quickRollPlayerSave(dicePopupHtml.promptId, dicePopupHtml.targetName, dicePopupHtml.saveType, dicePopupHtml.saveDc) : undefined} />}
                        </Popup>
                    )}
                    {pendingMetamagic && (
                      <MetamagicPopup
                        spell={{ name: pendingMetamagic.spellName, level: pendingMetamagic.spellLevel || 0 }}
                        playerStats={{ ...playerStats, _metamagicCurrentSP: pendingMetamagic._currentSP }}
                        campaignName={campaignName}
                        onConfirm={handleMetamagicConfirm}
                        onSkip={handleMetamagicSkip}
                      />
                    )}
            <hr />
            <div className='spell-abilities'>
                <div className="sectionHeader"><h4>&nbsp;Spells</h4></div>
                <div>
                    <b className={'clickable' + (cannotAct ? ' disabled-attack' : '') + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? ' stat--penalized' : '')} onClick={() => {
                      if (cannotAct) return;
                      const doAttack = (metaCtx) => {
                        rollAttack('Spell Attack', playerStats.spellAbilities.toHit - exhaustionPenalty, { forcedMode: conditionAttackMode !== 'normal' ? conditionAttackMode : undefined, ...metaCtx });
                      };
                      if (isSorcerer) {
                        const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));
                        setPendingMetamagic({
                          spellName: 'Spell Attack',
                          action: doAttack,
                          _currentSP: currentSP,
                        });
                      } else {
                        doAttack({});
                      }
                    }}>Attack (to hit):</b> <span className={exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? 'stat--penalized' : ''}>+{playerStats.spellAbilities.toHit - exhaustionPenalty}</span><br/>
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
                            <td className='left spell-name clickable' onClick={() => setSelectedSpell(spell)}>{spell.name}</td>
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
