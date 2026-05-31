  
import React, { useState, useEffect } from 'react'
import Popup from '../common/Popup.jsx'
import DiceRollResult from './DiceRollResult.jsx'
import { sanitizeHtml } from '../../services/sanitize.js';
import { parseMagicItemName } from '../../services/attackCalc.js';
import useLoggedDiceRoll from '../../hooks/useLoggedDiceRoll.js'
import { buildFeatureDetailHtml } from '../../hooks/useActionPopup.js'
import { rollExpression, rollExpressionDoubled } from '../../services/diceRoller.js'
import { getTargetFromAttacker, getCombatContext, getResistanceNotice, getAttackerTargetId } from '../../services/damageUtils.js';
import './CharActions.css'
import { isEqual } from 'lodash';

const signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });

const areEqual = (prevProps, nextProps) => isEqual(prevProps.playerStats, nextProps.playerStats);

const CharActions = React.memo(function CharActions({ playerStats, campaignName, exhaustionPenalty = 0, conditionAttackMode, cannotAct }) {
   const [actions, setActions] = useState([]);

    useEffect(() => {
      fetch('/data/actions.json')
             .then(response => response.json())
              .then(data => setActions(data))
           .catch(error => console.error('Error loading actions:', error));
        }, []);
     const { popupHtml, setPopupHtml, rollAttack, rollDamage, quickRollPlayerSave } = useLoggedDiceRoll(playerStats.name, campaignName, {
       autoDamageRoll: (autoDamage, isCrit) => {
         const result = isCrit ? rollExpressionDoubled(autoDamage.formula) : rollExpression(autoDamage.formula);
         if (result) {
           rollDamage(autoDamage.name, autoDamage.formula, result.total, result.rolls, result.modifier, {
             damageType: autoDamage.damageType,
             targetId: autoDamage.targetId,
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

    const buildAttackContext = React.useCallback((attack) => {
        const target = getCombatTargetInfo();
        const cs = getCombatContext();
        const rawTargetId = getAttackerTargetId(cs, playerStats.name);
        const resistanceNotice = target ? getResistanceNotice([attack.damageType], target.resistances, target.immunities, target.name) : null;
        return {
            damageType: attack.damageType,
            resistanceNotice,
            targetName: target?.name,
            targetId: rawTargetId || target?.id,
            saveDc: attack.saveDc,
            saveType: attack.saveType,
            dcSuccess: attack.saveSuccess,
            attackerName: playerStats.name,
            forcedMode: conditionAttackMode !== 'normal' ? conditionAttackMode : undefined,
            autoDamageFormula: attack.damage,
            autoDamageName: attack.name,
        };
    }, [getCombatTargetInfo, conditionAttackMode, playerStats.name]);

    const handleDamageClick = (attack) => {
        const wasCrit = popupHtml?.isCrit;
        if (wasCrit && setPopupHtml) setPopupHtml(null);
        const result = wasCrit ? rollExpressionDoubled(attack.damage) : rollExpression(attack.damage);
        if (result) {
            const ctx = buildAttackContext(attack);
            rollDamage(attack.name, attack.damage, result.total, result.rolls, result.modifier, ctx);
        }
    };

    // Helper function to get mastery for a weapon name
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
                                : <div className={(attack.hitBonusFormula ? "clickable" : "") + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? " stat--penalized" : "") + (cannotAct ? " disabled-attack" : "")} onClick={() => !cannotAct && rollAttack(attack.name, attack.hitBonus - exhaustionPenalty, buildAttackContext(attack))}>{signFormatter.format(attack.hitBonus - exhaustionPenalty)}</div>}
                            <div className={attack.damage ? "clickable" : ""} onClick={() => !cannotAct && handleDamageClick(attack)}>{attack.damage}</div>
                            <div className='left'>{attack.damageType}</div>
                            {is2024Rules && <div>{getWeaponMastery(attack.name) || ''}</div>}
                        </React.Fragment>;
                    })}
                </div>
                <br />
                                    {popupHtml && (
                                        <Popup onClickOrKeyDown={() => setPopupHtml && setPopupHtml(null)}>
                                            {typeof popupHtml === 'string' ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml) }}></div> : 
                                             <DiceRollResult {...popupHtml} onQuickRoll={popupHtml.waitingForPlayerSave ? () => quickRollPlayerSave(popupHtml.promptId, popupHtml.targetName, popupHtml.saveType, popupHtml.saveDc) : undefined} />}
                                        </Popup>
                                    )}
                {playerStats.actions.map((action) => {
                                        return <div key={action.name}>
                          <b className={action.details ? "clickable" : ""} onClick={() => setPopupHtml(buildFeatureDetailHtml(action))}>{action.name}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(action.description) }}></span>
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
                                : <div className={(attack.hitBonusFormula ? "clickable" : "") + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? " stat--penalized" : "") + (cannotAct ? " disabled-attack" : "")} onClick={() => !cannotAct && rollAttack(attack.name, attack.hitBonus - exhaustionPenalty, buildAttackContext(attack))}>{signFormatter.format(attack.hitBonus - exhaustionPenalty)}</div>}
                                <div className={attack.damage ? "clickable" : ""} onClick={() => !cannotAct && handleDamageClick(attack)}>{attack.damage}</div>
                                <div className='left'>{attack.damageType}</div>
                                {is2024Rules && <div>{getWeaponMastery(attack.name) || ''}</div>}
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
                                                        return <div key={bonusAction.name}>
                {popupHtml && (
                    <Popup onClickOrKeyDown={() => setPopupHtml && setPopupHtml(null)}>
                        {typeof popupHtml === 'string' ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml) }}></div> : 
                         <DiceRollResult {...popupHtml} onQuickRoll={popupHtml.waitingForPlayerSave ? () => quickRollPlayerSave(popupHtml.promptId, popupHtml.targetName, popupHtml.saveType, popupHtml.saveDc) : undefined} />}
                    </Popup>
                )}
                                  <b className={bonusAction.details ? "clickable" : ""} onClick={() => setPopupHtml(buildFeatureDetailHtml(bonusAction))}>{bonusAction.name}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(bonusAction.description) }}></span>
                             </div>
                        })}
                    </div>}
                </div>}
            </div>
        </div>
    )
}, areEqual);

export default CharActions