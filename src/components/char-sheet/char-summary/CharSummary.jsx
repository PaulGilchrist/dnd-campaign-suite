  
import React from 'react'
import './CharSummary.css'

import rulesFactory from '../../../services/rulesFactory.js'
import CharGold from './CharGold.jsx'
import CharHitPoints from './CharHitPoints.jsx'
import CharClassFeatures from './CharClassFeatures.jsx'
import CharFeats from '../char-feats/CharFeats.jsx'
import HiddenInput from '../../common/HiddenInput.jsx'
import Popup from '../../common/Popup.jsx'
import useTrackedResource from '../../../hooks/useTrackedResource.js'
import useDiceRoll from '../../../hooks/useDiceRoll.js'
import { rollDice } from '../../../services/diceRoller.js'
import LongRestButton from '../LongRestButton.jsx'

const signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });

function CharSummary({ playerStats, onDeleteCharacter, onEditCharacter, onUploadClick, onSaveClick, campaignName, onLongRest }) {
    const { popupHtml, setPopupHtml, rollInitiative } = useDiceRoll();
    const [showInput, setShowInput] = React.useState(false);
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    const { current: hasInspiration, update: setHasInspiration } = useTrackedResource(
        'hasInspiration',
        playerStats.name,
        () => false,
        [playerStats],
        campaignName
    );
    const handleToggleInspiration = () => {
        const newValue = !hasInspiration;
        setHasInspiration(newValue);
    };

    const { current: shortRestHitDice, update: handleShortRestHitDiceChange } = useTrackedResource(
        'shortRestHitDice',
        playerStats.name,
        () => playerStats.level,
        [playerStats],
        campaignName
    );
    const handleShortRestHitDiceToggle = () => {
        setShowInput((showInput) => !showInput);
    };

    const handleRollHitDice = () => {
        if (shortRestHitDice <= 0) return;
        const con = playerStats.abilities?.find((a) => a.name === 'Constitution');
        const conMod = con?.bonus || 0;
        const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
        const hitDie = classLevel?.hit_die || 8;
        const { total, rolls } = rollDice(1, hitDie);
        const hpRecovered = total + conMod;
        const newRemaining = shortRestHitDice - 1;
        handleShortRestHitDiceChange(newRemaining);

        setPopupHtml(
            `<div class="dice-roll-result">`
            + `<div class="dice-roll-header"><i class="fa-solid fa-heart"></i>Hit Dice</div>`
            + `<div class="dice-roll-total">${Math.max(1, hpRecovered)}</div>`
            + `<div class="dice-roll-breakdown">1d${hitDie} (<span class="dice-rolled">${rolls[0]}</span>) ${signFormatter.format(conMod)}<br/>HP recovered</div>`
            + `<div class="dice-roll-breakdown">Remaining Hit Dice: ${newRemaining}</div>`
            + `<div class="dice-roll-hint">click to dismiss</div></div>`
        );
    };

    let speed = playerStats.race.subrace && playerStats.race.subrace.speed ? playerStats.race.subrace.speed : playerStats.race.speed;
    if (playerStats.class.name === 'Monk') {
        const { classRules: cr } = rulesFactory.getRules(playerStats);
        if (typeof cr.getUnarmoredMovementIncrease === 'function') {
            speed += cr.getUnarmoredMovementIncrease(playerStats);
        }
    }
        if (playerStats.class.name === 'Barbarian') {
        const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
        const unarmoredMovement = classLevel?.class_specific?.unarmored_movement || 0;
        speed += unarmoredMovement;
    }
    const showArmorClassFormulaPopup = () => {
        const html = `Armor Class (${playerStats.armorClass}) = ${playerStats.armorClassFormula}`
        setPopupHtml(html);
    }

    const handleDeleteCharacter = () => {
        if (window.confirm('Are you sure you want to delete this character? This action is irreversible.')) {
            onDeleteCharacter(playerStats.name);
        }
    };

    return (
        <div>
              {popupHtml && <Popup html={popupHtml} onClickOrKeyDown={() => setPopupHtml(null)} />}
            <div className='name-row'>
                <span className='name'>{playerStats.name}</span>&nbsp;&nbsp;
                {isLocalhost && (
                    <div className='char-btn-group no-print'>
                        <button className="char-btn" onClick={onEditCharacter} title="Edit Character"><i className="fas fa-pen"></i> Edit</button>
                        <button className="char-btn" onClick={handleDeleteCharacter} title="Delete Character">Delete</button>
                        <button className="char-btn" onClick={onUploadClick} title="Upload Character"><i className="fas fa-arrow-up"></i> Upload</button>
                        <button className="char-btn" onClick={onSaveClick} title="Download Character"><i className="fas fa-arrow-down"></i> Download</button>
                        <LongRestButton playerStats={playerStats} campaignName={campaignName} onLongRest={onLongRest} />
                    </div>
                )}
            </div>
            <div className='summary'>
                {playerStats.race.subrace && playerStats.race.subrace.name ? playerStats.race.subrace.name : playerStats.race.name}
                {playerStats.race.type ? ` (${playerStats.race.type.toLowerCase()})` : ''},&nbsp;
                {playerStats.class.name}{playerStats.class.subclass ? ` (${playerStats.class.subclass.name.toLowerCase()}` : ''}
                {playerStats.class.subclass && playerStats.class.subclass.type ? `-${playerStats.class.subclass.type.toLowerCase()}` : ''}
                ), Level {playerStats.level}, {playerStats.alignment}
            </div>
            <div className='summaryGrid'>
                <div>
                    <div className='clickable' onClick={showArmorClassFormulaPopup}><b>Armor Class: </b>{playerStats.armorClass}</div>
                    <CharHitPoints playerStats={playerStats} campaignName={campaignName}></CharHitPoints>
                    <b>Speed: </b>{speed} ft.<br />
                    <CharGold playerStats={playerStats} campaignName={campaignName}></CharGold>
                </div>
                <div>
                    <b>Proficiency: </b>+{playerStats.proficiency}<br />
                    <span className='clickable' onClick={() => rollInitiative(playerStats.initiative)}><b>Initiative: </b>{signFormatter.format(playerStats.initiative)}</span><br />
                    <b>Inspiration: </b><input tabIndex={0} type="checkbox" checked={hasInspiration} onChange={handleToggleInspiration} /><br />
                    <div className="clickable" onClick={handleRollHitDice} onKeyDown={(e) => { if (e.key === 'Enter') handleRollHitDice(); }} tabIndex={0}>
                        <b>Roll Hit Die:</b> {shortRestHitDice > 0 ? `${playerStats.class?.class_levels?.[playerStats.level - 1]?.hit_die || 'd8'} (${shortRestHitDice} left)` : 'None remaining'}
                    </div>
                    <div className="clickable" onClick={handleShortRestHitDiceToggle} onKeyDown={handleShortRestHitDiceToggle} tabIndex={0}>
                        <b>Short Rest Hit Dice:</b> {playerStats.level}/<HiddenInput handleInputToggle={handleShortRestHitDiceToggle} handleValueChange={(value) => handleShortRestHitDiceChange(value)} showInput={showInput} value={shortRestHitDice}></HiddenInput> <span className="text-muted">(max/cur)</span>
                    </div>
                </div>
                <div>
                    <CharFeats playerStats={playerStats} showPopup={(feat) => {
                                             if (feat.desc || feat.description) {
                              // Handle both array (5e) and string (2024) description formats
                            let descriptionHtml = '';
                            if (Array.isArray(feat.desc)) {
                                descriptionHtml = feat.desc.map(desc => desc || '').join('<br/>');
                            } else if (feat.description) {
                                descriptionHtml = feat.description;
                            } else {
                                descriptionHtml = feat.desc || '';
                            }
                            let html = `<b>${feat.name}</b><br/><br/>${descriptionHtml}<br/>`;
                            if (feat.prerequisites) {
                                html += `<br/><b>Prerequisites:</b><br/>`;
                                if (feat.prerequisites.level) {
                                    html += `Level ${feat.prerequisites.level}<br/>`;
                                }
                                if (feat.prerequisites.ability_scores) {
                                    feat.prerequisites.ability_scores.forEach(as => {
                                        html += `${as.name} ${as.minimum} or higher<br/>`;
                                    });
                                }
                                if (feat.prerequisites.proficiency) {
                                    html += `Proficiency with ${feat.prerequisites.proficiency}<br/>`;
                                }
                            }
                            if (feat.benefits && feat.benefits.length > 0) {
                                html += `<br/><b>Benefits:</b><ul>`;
                                feat.benefits.forEach(benefit => {
                                    html += `<li>${benefit.description || benefit}</li>`;
                                });
                                html += `</ul>`;
                            }
                            setPopupHtml(html);
                        }
                    }} />
                    {playerStats.background && <div><b>Background: </b>{playerStats.background}</div>}
                      <CharClassFeatures playerStats={playerStats} />
                </div>
      </div>
          {playerStats.resistances != null && playerStats.resistances.length > 0 && <div>
              <b>Resistances: </b>
              {playerStats.resistances.join(', ')}
          </div>}
          {playerStats.immunities != null && playerStats.immunities.length > 0 && <div>
              <b>Immunities: </b>
              {playerStats.immunities.join(', ')}
          </div>}
          {playerStats.vulnerabilities != null && playerStats.vulnerabilities.length > 0 && <span><b>Vulnerabilities: </b>{playerStats.vulnerabilities.join(', ')}</span>}
            {playerStats.senses != null && playerStats.senses.length > 0 && <div><b>Senses: </b>{playerStats.senses.map((sense) => { return `${sense.name} ${sense.value}`;}).join(', ')}</div>}
            {playerStats.proficiencies != null && playerStats.proficiencies.length > 0 && <div><b>Proficiencies: </b>{playerStats.proficiencies.join(', ')}</div>}
            {playerStats.languages != null && playerStats.languages.length > 0 && <span><b>Languages: </b>{playerStats.languages.join(', ')}</span>}<br />
  </div>
)
}

export default CharSummary

