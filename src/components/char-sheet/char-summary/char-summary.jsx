/* eslint-disable react/prop-types */
import React from 'react'
import './char-summary.css'

import storage from '../../../services/storage'
import classRules from '../../../services/class-rules-2024.js'
import CharGold from './char-gold'
import CharHitPoints from './char-hit-points'
import CharClassFeatures from './char-class-features'
import CharFeats from '../char-feats/char-feats'
import HiddenInput from '../../common/hidden-input'
import usePopup from '../common/use-popup'

function CharSummary({ playerStats, onDeleteCharacter }) {
    const [hasInspiration, setHasInspiration] = React.useState(false);
    const { PopupElement, setPopupHtml } = usePopup(() => null);
    const [shortRestHitDice, setShortRestHitDice] = React.useState(0);
    const [showInput, setShowInput] = React.useState(false);
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    React.useEffect(() => {
        let shortRestHitDice = storage.getProperty(playerStats.name, 'shortRestHitDice');
        setShortRestHitDice(shortRestHitDice ? shortRestHitDice : playerStats.level);
    }, [playerStats]);
    const handleShortRestHitDiceToggle = () => {
        setShowInput((showInput) => !showInput);
    };
    const handleShortRestHitDiceChange = (shortRestHitDice) => {
        storage.setProperty(playerStats.name, 'shortRestHitDice', shortRestHitDice);
        setShortRestHitDice(shortRestHitDice);
    };

    React.useEffect(() => {
        let value = storage.getProperty(playerStats.name, 'hasInspiration');
        setHasInspiration(value ? value : false);
    }, [playerStats]);
    let speed = playerStats.race.subrace && playerStats.race.subrace.speed ? playerStats.race.subrace.speed : playerStats.race.speed;
    if (playerStats.class.name === 'Monk') {
        const unarmoredMovementIncrease = classRules.getUnarmoredMovementIncrease(playerStats);
        speed += unarmoredMovementIncrease;
    }
        if (playerStats.class.name === 'Barbarian') {
        const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
        const unarmoredMovement = classLevel?.class_specific?.unarmored_movement || 0;
        speed += unarmoredMovement;
    }
    const handleToggleInspiraction = () => {
        const newValue = !hasInspiration;
        storage.setProperty(playerStats.name, 'hasInspiration', newValue);
        setHasInspiration(newValue);
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
             {PopupElement}
            <div className='name'>
                {playerStats.name}
                {isLocalhost && (
                    <button className="delete-character-btn" onClick={handleDeleteCharacter} title="Delete Character">
                        <i className="fas fa-trash"></i>
                    </button>
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
                    <CharHitPoints playerStats={playerStats}></CharHitPoints>
                    <b>Speed: </b>{speed} ft.<br />
                    <CharGold playerStats={playerStats}></CharGold>
                </div>
                <div>
                    <b>Proficiency: </b>+{playerStats.proficiency}<br />
                    <b>Initiative: </b>+{playerStats.initiative}<br />
                    <b>Inspiration: </b><input tabIndex={0} type="checkbox" checked={hasInspiration} onChange={handleToggleInspiraction} /><br />
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

