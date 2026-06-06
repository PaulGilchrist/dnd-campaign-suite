
import React from 'react'
import { cloneDeep } from 'lodash';
import useActionPopup from '../../../hooks/useActionPopup.js'
import useLoggedDiceRoll from '../../../hooks/useLoggedDiceRoll.js'
import Popup from '../../common/Popup.jsx'
import DiceRollResult from '../DiceRollResult.jsx'
import MetamagicPopup from '../MetamagicPopup.jsx'
import SpellDetailPopup from './SpellDetailPopup.jsx'
import CharSpellSlots from './CharSpellSlots.jsx'
import { rollExpression, rollExpressionDoubled } from '../../../services/diceRoller.js';
import { sanitizeHtml } from '../../../services/sanitize.js';
import { getCombatContext, getTargetFromAttacker } from '../../../services/damageUtils.js';
import { getCurrentSorceryPoints, getMaxSorceryPoints, spendSorceryPoints } from '../../../hooks/useMetamagic.js'
import { useSpellMetamagicFlow } from '../../../hooks/useSpellMetamagicFlow.js'
import { useSpellUpcastFlow } from '../../../hooks/useSpellUpcastFlow.js'
import UpcastPopup from './UpcastPopup.jsx'
import { executeSpellCast } from '../../../services/spellCastService.js'
import * as mapsService from '../../../services/mapsService.js';
import { getNearestPlacedItem } from '../../../services/rangeValidation.js';
import { isInnateSorceryActive } from '../../../services/buffService.js';
import { useRuntimeValue } from '../../../hooks/useRuntimeState.js';
import './CharSpells.css'

const CharSpells = function CharSpells({ playerStats, handleTogglePreparedSpells, campaignName, exhaustionPenalty = 0, conditionAttackMode, cannotAct, mapName, characters }) {
    const _activeBuffs = useRuntimeValue(playerStats.name, 'activeBuffs', campaignName); (void _activeBuffs); // subscribe to activeBuffs changes for re-render
    const innateSorceryActive = isInnateSorceryActive(playerStats.name, campaignName);
    const { popupHtml, setPopupHtml } = useActionPopup('spell');
     const { popupHtml: dicePopupHtml, setPopupHtml: setDicePopupHtml, rollAttack, rollDamage, quickRollPlayerSave } = useLoggedDiceRoll(playerStats.name, campaignName, {
        characters,
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
            if (autoDamage.metamagicTwinTarget) {
              context.metamagicTwinTarget = autoDamage.metamagicTwinTarget;
            }
            if (autoDamage.metamagicHeighten) {
              context.metamagicHeighten = autoDamage.metamagicHeighten;
            }
            rollDamage(autoDamage.name, autoDamage.formula, result.total, result.rolls, result.modifier, context);
            }
           },
         });
    const [selectedSpell, setSelectedSpell] = React.useState(null);
    const isSorcerer = playerStats.class?.name === 'Sorcerer';
    const [pendingSimpleMetamagic, setPendingSimpleMetamagic] = React.useState(null);

    const handleSimpleConfirm = React.useCallback((result) => {
      const pending = pendingSimpleMetamagic;
      setPendingSimpleMetamagic(null);
      if (!pending) return;
      if (result?.totalCost > 0) spendSorceryPoints(playerStats.name, result.totalCost, campaignName, getMaxSorceryPoints(playerStats));
      const metaCtx = {};
      if (result?.options) {
        if (result.options.includes('Heightened Spell')) metaCtx.metamagicHeighten = true;
        if (result.options.includes('Careful Spell')) metaCtx.metamagicCareful = true;
        if (result.options.includes('Twinned Spell') && result.twinTarget) metaCtx.metamagicTwinTarget = result.twinTarget;
        if (result.options.includes('Distant Spell')) metaCtx.metamagicDistant = true;
      }
      pending.action(metaCtx);
    }, [pendingSimpleMetamagic, playerStats, campaignName]);

    const handleSimpleSkip = React.useCallback(() => {
      const pending = pendingSimpleMetamagic;
      setPendingSimpleMetamagic(null);
      if (!pending) return;
      pending.action({});
    }, [pendingSimpleMetamagic]);

    const getDamageFormula = (effect) => {
        const match = effect.match(/^(\d+d\d+(?:[+-]\d+)?)/);
        return match ? match[1] : null;
    };

    const getTargetInfo = React.useCallback(async () => {
        const cs = await getCombatContext(campaignName);
        if (!cs) return null;
        return getTargetFromAttacker(cs, playerStats.name);
    }, [playerStats.name, campaignName]);

    const cachedCastPosRef = React.useRef(null);

    const castAction = React.useCallback((spell, metaCtx) => {
      const pos = cachedCastPosRef.current;
      executeSpellCast(spell, metaCtx, { rollAttack, rollDamage, playerStats, getTargetInfo, attackerPos: pos?.attackerPos, targetPos: pos?.targetPos, campaignName });
      cachedCastPosRef.current = null;
      }, [rollAttack, rollDamage, playerStats, getTargetInfo, campaignName]);
    const { pendingMetamagic, gateMetamagic, handleConfirm, handleSkip } = useSpellMetamagicFlow(playerStats, campaignName, castAction);
    const { pendingUpcast, buildUpcastLevels, gateUpcast, handleUpcastConfirm, handleUpcastCancel, getCantripAutoLevel } = useSpellUpcastFlow(playerStats, campaignName);

    const resolveSpellPositions = React.useCallback(async () => {
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
              cachedCastPosRef.current = {
                attackerPos: { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                targetPos,
              };
            }
          }
        }
      } catch { /* positions unavailable */ }
    }, [mapName, campaignName, playerStats.name]);

    const handleSpellCast = React.useCallback(async (spell) => {
      setSelectedSpell(null);

      await resolveSpellPositions();
      gateMetamagic(spell);
    }, [gateMetamagic, resolveSpellPositions]);

    const executeDamageRoll = (formula, spellName, spell) => {
        const wasCrit = dicePopupHtml?.isCrit;
        if (wasCrit && setDicePopupHtml) setDicePopupHtml(null);
        const result = wasCrit ? rollExpressionDoubled(formula) : rollExpression(formula);
        if (result) {
            const doDamage = async (metaCtx) => {
                const target = await getTargetInfo();
                const context = {
                    targetName: target?.name,
                    attackerName: playerStats.name,
                    damageType: spell.damage?.damage_type || '',
                    ...metaCtx,
                };
                if (spell.dc) {
                    context.dc = playerStats.spellAbilities.saveDc + (innateSorceryActive ? 1 : 0);
                    context.dcType = spell.dc.dc_type;
                    context.dcSuccess = spell.dc.dc_success;
                    context.saveDc = playerStats.spellAbilities.saveDc + (innateSorceryActive ? 1 : 0);
                    context.saveType = spell.dc.dc_type;
                    context.dcSuccess = spell.dc.dc_success;
                 }
                rollDamage(spellName, formula, result.total, result.rolls, result.modifier, context);
            };
            if (isSorcerer) {
                const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));
                setPendingSimpleMetamagic({
                    spellName,
                    action: doDamage,
                    _currentSP: currentSP,
                });
            } else {
                doDamage({});
            }
        }
    };

    const handleDamageRoll = (formula, spellName, spell) => {
      const afterUpcast = (modifiedSpell) => {
        const upcastFormula = modifiedSpell.damage?.damage_at_slot_level?.[modifiedSpell.level]
          || modifiedSpell.damage?.damage_at_character_level?.[modifiedSpell.level]
          || formula;
        executeDamageRoll(upcastFormula, modifiedSpell.name || spellName, modifiedSpell);
      };

      if (gateUpcast(spell, afterUpcast, false)) {
        return;
      }

      if (spell.level === 0) {
        const autoLevel = getCantripAutoLevel(spell, playerStats.level);
        if (autoLevel) {
          const modifiedSpell = { ...spell, level: autoLevel };
          const upcastFormula = modifiedSpell.damage?.damage_at_slot_level?.[modifiedSpell.level]
            || modifiedSpell.damage?.damage_at_character_level?.[modifiedSpell.level]
            || formula;
          executeDamageRoll(upcastFormula, modifiedSpell.name || spellName, modifiedSpell);
          return;
        }
      }

      executeDamageRoll(formula, spellName, spell);
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
                                playerLevel={playerStats.level}
                                upcastLevels={buildUpcastLevels(selectedSpell)}
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
                    {pendingUpcast && (
                      <UpcastPopup
                        spell={pendingUpcast.spell}
                        levels={buildUpcastLevels(pendingUpcast.spell)}
                        onConfirm={handleUpcastConfirm}
                        onCancel={handleUpcastCancel}
                      />
                    )}
                    {pendingMetamagic && (
                      <MetamagicPopup
                        spell={{ name: pendingMetamagic.spellName, level: pendingMetamagic.spellLevel || 0 }}
                        playerStats={{ ...playerStats, _metamagicCurrentSP: pendingMetamagic._currentSP }}
                        campaignName={campaignName}
                        onConfirm={handleConfirm}
                        onSkip={handleSkip}
                      />
                    )}
                    {pendingSimpleMetamagic && (
                      <MetamagicPopup
                        spell={{ name: pendingSimpleMetamagic.spellName, level: pendingSimpleMetamagic.spellLevel || 0 }}
                        playerStats={{ ...playerStats, _metamagicCurrentSP: pendingSimpleMetamagic._currentSP }}
                        campaignName={campaignName}
                        onConfirm={handleSimpleConfirm}
                        onSkip={handleSimpleSkip}
                      />
                    )}
            <hr />
            <div className='spell-abilities'>
                <div className="sectionHeader"><h4>&nbsp;Spells</h4></div>
                <div>
                    <b className={'clickable' + (cannotAct ? ' disabled-attack' : '') + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? ' stat--penalized' : '')} onClick={() => {
                      if (cannotAct) return;
                       const doAttack = (metaCtx) => {
                         const innateAdv = isSorcerer && innateSorceryActive && !conditionAttackMode ? 'advantage' : undefined;
                         rollAttack('Spell Attack', playerStats.spellAbilities.toHit - exhaustionPenalty, { forcedMode: conditionAttackMode !== 'normal' ? conditionAttackMode : innateAdv, ...metaCtx });
                        };
                      if (isSorcerer) {
                        const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));
                        setPendingSimpleMetamagic({
                          spellName: 'Spell Attack',
                          action: doAttack,
                          _currentSP: currentSP,
                        });
                      } else {
                        doAttack({});
                      }
                    }}>Attack (to hit):</b> <span className={exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? 'stat--penalized' : ''}>+{playerStats.spellAbilities.toHit - exhaustionPenalty}</span><br/>
                    <b>Modifier:</b> <span className={exhaustionPenalty > 0 ? 'stat--penalized' : ''}>+{playerStats.spellAbilities.modifier - exhaustionPenalty}</span><br/>
                      <b>Save DC:</b> {playerStats.spellAbilities.saveDc + (innateSorceryActive ? 1 : 0)}
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
                                const isCantrip = spell.level === 0;
                                if (isCantrip) {
                                    const lvls = Object.keys(dmgObj).map(Number).filter(l => l <= playerStats.level);
                                    const bestLevel = lvls.length > 0 ? Math.max(...lvls) : Object.keys(dmgObj)[0];
                                    effect = `${dmgObj[bestLevel]} ${spell.damage.damage_type}`;
                                } else {
                                    effect = `${dmgObj[Object.keys(dmgObj)[0]]} ${spell.damage.damage_type}`;
                                }
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
