 
import React, { useState, useEffect } from 'react'
import useActionPopup from '../../hooks/use-action-popup.js'
import Popup from '../common/popup.jsx'
import { sanitizeHtml } from '../../services/sanitize.js';
import { parseMagicItemName } from '../../services/attack-calc.js';
import './char-actions.css'
import { isEqual } from 'lodash';

const signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });

const areEqual = (prevProps, nextProps) => isEqual(prevProps.playerStats, nextProps.playerStats);

const CharActions = React.memo(function CharActions({ playerStats }) {
  const [actions, setActions] = useState([]);

  useEffect(() => {
    fetch('/data/actions.json')
          .then(response => response.json())
          .then(data => setActions(data))
          .catch(error => console.error('Error loading actions:', error));
    }, []);
    const { showPopup, popupHtml, setPopupHtml } = useActionPopup('feature');

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
        <div>
            <div>
                <span className='sectionHeader'>Actions</span>
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
                            <div className={attack.hitBonusFormula ? "clickable" : ""} onClick={() => setPopupHtml(attack.hitBonusFormula)}>{signFormatter.format(attack.hitBonus)}</div>
                            <div className={attack.damageFormula ? "clickable" : ""} onClick={() => setPopupHtml(attack.damageFormula)}>{attack.damage}</div>
                            <div className='left'>{attack.damageType}</div>
                            {is2024Rules && <div>{getWeaponMastery(attack.name) || ''}</div>}
                        </React.Fragment>;
                    })}
                </div>
                <br />
                {playerStats.actions.map((action) => {
                                        return <div key={action.name}>
                          {popupHtml && <Popup html={popupHtml} onClickOrKeyDown={() => setPopupHtml && setPopupHtml(null)} />}
                          <b className={action.details ? "clickable" : ""} onClick={() => showPopup(action)}>{action.name}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(action.description) }}></span>
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
                                <div>{signFormatter.format(attack.hitBonus)}</div>
                                <div>{attack.damage}</div>
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
                                  {popupHtml && <Popup html={popupHtml} onClickOrKeyDown={() => setPopupHtml && setPopupHtml(null)} />}
                                  <b className={bonusAction.details ? "clickable" : ""} onClick={() => showPopup(bonusAction)}>{bonusAction.name}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(bonusAction.description) }}></span>
                             </div>
                        })}
                    </div>}
                </div>}
            </div>
        </div>
    )
}, areEqual);

export default CharActions
