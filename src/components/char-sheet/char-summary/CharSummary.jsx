
import React from 'react'
import './CharSummary.css'
import DiceRollResult from '../DiceRollResult.jsx'

import rulesFactory from '../../../services/rulesFactory.js'
import CharGold from './CharGold.jsx'
import CharHitPoints from './CharHitPoints.jsx'
import CharClassFeatures from './CharClassFeatures.jsx'
import CharFeats from '../char-feats/CharFeats.jsx'
import Popup from '../../common/Popup.jsx'
import AvatarImage from '../../common/AvatarImage.jsx'
import AvatarModal from '../../common/AvatarModal.jsx';
import useTrackedResource from '../../../hooks/useTrackedResource.js'
import useLoggedDiceRoll from '../../../hooks/useLoggedDiceRoll.js';
import { sanitizeHtml } from '../../../services/sanitize.js';
import LongRestButton from '../LongRestButton.jsx'
import ShortRestButton from '../ShortRestButton.jsx'
import ShortRestModal from '../ShortRestModal.jsx'
import storage from '../../../services/storage.js'
import CharConditions from './CharConditions.jsx'

const signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });

function CharSummary({ playerStats, onDeleteCharacter, onEditCharacter, onUploadClick, onSaveClick, campaignName, onLongRest, exhaustionLevel, onExhaustionChange, conditionEffects, onConditionsChange }) {
    const { popupHtml, setPopupHtml, rollInitiative } = useLoggedDiceRoll(playerStats.name, campaignName);
    const [showShortRest, setShowShortRest] = React.useState(false);
    const [showXpModal, setShowXpModal] = React.useState(false);
    const [xpDelta, setXpDelta] = React.useState('');
    const [displayXp, setDisplayXp] = React.useState(playerStats?.xp ?? 0);
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const [showAvatarModal, setShowAvatarModal] = React.useState(false);
    React.useEffect(() => {
        setDisplayXp(playerStats?.xp ?? 0);
    }, [playerStats?.xp]);

    const isInXpMode = (playerStats?.xpMode || 'milestone') === 'experience';

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

    const handleXpModalOpen = () => {
        setXpDelta('');
        setShowXpModal(true);
    };

    const handleXpSave = () => {
        if (!xpDelta.trim()) {
            setShowXpModal(false);
            return;
        }
        const delta = parseInt(xpDelta, 10);
        if (isNaN(delta)) {
            setShowXpModal(false);
            return;
        }
        const newXp = Math.max(0, displayXp + delta);
        setDisplayXp(newXp);
        storage.setProperty(playerStats.name, 'xp', newXp, campaignName);
        setShowXpModal(false);
    };

    const handleXpModeToggle = (e) => {
        const newMode = e.target.checked ? 'milestone' : 'experience';
        playerStats.xpMode = newMode;
        storage.setProperty(playerStats.name, 'xpMode', newMode, campaignName);
        setShowXpModal(false);
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
    speed = Math.max(0, speed - (5 * exhaustionLevel));
    if (conditionEffects?.speedZero) speed = 0;

    const exhaustionPenalty = 2 * exhaustionLevel;
    const effectiveInitiative = playerStats.initiative - exhaustionPenalty;
    const showArmorClassFormulaPopup = () => {
        const html = `Armor Class (${playerStats.armorClass}) = ${playerStats.armorClassFormula}`
        setPopupHtml(html);
    }

    const handleDeleteCharacter = () => {
        if (window.confirm('Are you sure you want to delete this character? This action is irreversible.')) {
            onDeleteCharacter(playerStats.name);
        }
    };

    const handleShortRestComplete = () => {
        setShowShortRest(false);
        onLongRest && onLongRest();
    };

    const levelSuffix = isInXpMode
        ? ` (${displayXp.toLocaleString()} XP)`
        : ' (milestone)';

    return (
        <div>
                {popupHtml && (
                    <Popup onClickOrKeyDown={() => setPopupHtml(null)}>
                        {typeof popupHtml === 'string' ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml) }}></div> : 
                         <DiceRollResult {...popupHtml} />}
                    </Popup>
                )}
            <div className='char-header'>
                <AvatarImage name={playerStats.name} imagePath={playerStats.imagePath} size={60} onClick={() => setShowAvatarModal(true)} />
                <div className='char-header-text'>
                    <div className='name-row'>
                        <span className='name'>{playerStats.name}</span>&nbsp;&nbsp;
                        {isLocalhost && (
                            <div className='char-btn-group no-print'>
                                <button className="char-btn" onClick={onEditCharacter} title="Edit Character"><i className="fas fa-pen"></i> Edit</button>
                                <button className="char-btn" onClick={handleDeleteCharacter} title="Delete Character">Delete</button>
                                <button className="char-btn" onClick={onUploadClick} title="Upload Character"><i className="fas fa-arrow-up"></i> Upload</button>
                                <button className="char-btn" onClick={onSaveClick} title="Download Character"><i className="fas fa-arrow-down"></i> Download</button>
                                <ShortRestButton onClick={() => setShowShortRest(true)} />
                                <LongRestButton playerStats={playerStats} campaignName={campaignName} onLongRest={onLongRest} />
                            </div>
                        )}
                    </div>
                    <div className='summary' data-testid='char-summary-text'>
                        {playerStats.race.subrace && playerStats.race.subrace.name ? playerStats.race.subrace.name : playerStats.race.name}
                        {playerStats.race.type ? ` (${playerStats.race.type.toLowerCase()})` : ''},&nbsp;
                        {playerStats.class.name}{playerStats.class.subclass ? ` (${playerStats.class.subclass.name.toLowerCase()}` : ''}
                        {playerStats.class.subclass && playerStats.class.subclass.type ? `-${playerStats.class.subclass.type.toLowerCase()}` : ''}
                        ), Level {playerStats.level}<span className='clickable' onClick={handleXpModalOpen}>{levelSuffix}</span>, {playerStats.alignment}
                    </div>
                </div>
            </div>
            <div className='summaryGrid'>
                <div>
                    <div className='clickable' onClick={showArmorClassFormulaPopup}><b>Armor Class: </b>{playerStats.armorClass}</div>
                    <CharHitPoints playerStats={playerStats} campaignName={campaignName}></CharHitPoints>
                    <b>Speed: </b><span className={exhaustionLevel > 0 || conditionEffects?.speedZero ? 'stat--penalized' : ''}>{speed}</span> ft.<br />
                    <CharGold playerStats={playerStats} campaignName={campaignName}></CharGold>
                </div>
                <div>
                    <b>Proficiency: </b>+{playerStats.proficiency}<br />
                    <span className={'clickable' + (exhaustionLevel > 0 ? ' stat--penalized' : '')} onClick={() => rollInitiative(effectiveInitiative)}><b>Initiative: </b>{signFormatter.format(effectiveInitiative)}</span><br />
                    <b>Inspiration: </b><input tabIndex={0} type="checkbox" checked={hasInspiration} onChange={handleToggleInspiration} /><br />
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
            {showShortRest && (
                <ShortRestModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setShowShortRest(false)}
                    onComplete={handleShortRestComplete}
                />
            )}
            {showXpModal && (
              <div className='xp-modal-overlay' onClick={(e) => { if (e.target === e.currentTarget) setShowXpModal(false); }}>
                <div className='xp-modal'>
                  <h3>Experience Points</h3>
                  <div className='xp-modal-section'>
                    <label>
                      <span className='xp-label-text'>Add or subtract XP:</span>
                      <input
                        type='number'
                        value={xpDelta}
                        onChange={(e) => setXpDelta(e.target.value)}
                        placeholder={'+100 or -50'}
                        autoFocus
                      />
                    </label>
                    <div className='xp-preview'>
                      Current: {displayXp.toLocaleString()} XP
                      {xpDelta && !isNaN(parseInt(xpDelta, 10)) ? (
                        <span className='xp-preview-new'>
                          {' → '}{(Math.max(0, displayXp + parseInt(xpDelta, 10))).toLocaleString()} XP
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className='xp-modal-section'>
                    <label className='xp-checkbox-label'>
                      <input
                        type='checkbox'
                        checked={!isInXpMode}
                        onChange={handleXpModeToggle}
                      />
                      Milestone Leveling
                    </label>
                    {!isInXpMode && (
                      <div className='xp-modal-info'>
                        XP tracking is disabled. Uncheck to enable XP display in the subtitle.
                      </div>
                    )}
                  </div>
                  <div className='xp-modal-actions'>
                    <button className='char-btn' onClick={handleXpSave}>Apply</button>
                    <button className='char-btn' onClick={() => setShowXpModal(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
            <div className='no-print'>
            {showAvatarModal && playerStats.imagePath && (
                <AvatarModal
                    name={playerStats.name}
                    imagePath={playerStats.imagePath}
                    onClose={() => setShowAvatarModal(false)}
                />
            )}
              <CharConditions playerStats={playerStats} campaignName={campaignName} exhaustionLevel={exhaustionLevel} onExhaustionChange={onExhaustionChange} onConditionsChange={onConditionsChange} />
            </div>
  </div>
)
}

export default CharSummary
