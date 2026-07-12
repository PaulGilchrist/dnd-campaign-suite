
import React from 'react'
import './CharSummary.css'

import rulesFactory from '../../../services/rules/rulesFactory.js'
import { parseMagicItemName } from '../../../services/rules/core/attackCalc.js'
import CharGold from './CharGold.jsx'
import CharHitPoints from './CharHitPoints.jsx'
import CharClassFeatures from './CharClassFeatures.jsx'
import CharFeats from '../char-feats/CharFeats.jsx'
import AvatarImage from '../../common/AvatarImage.jsx'
import AvatarModal from '../../common/AvatarModal.jsx';
import useTrackedResource from '../../../hooks/runtime/useTrackedResource.js'

import { showBackgroundPopup } from '../../../hooks/combat/useActionPopup.js';
import useLoggedDiceRoll from '../../../hooks/combat/useLoggedDiceRoll.js';
import { useDiceRollPopup } from '../../../hooks/combat/DiceRollContext.js';
import LongRestButton from '../LongRestButton.jsx'
import ShortRestButton from '../ShortRestButton.jsx'
import ShortRestModal from '../ShortRestModal.jsx'
import { setRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';
import CharConditions from './CharConditions.jsx'

const signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });

function CharSummary({ playerStats, onDeleteCharacter, onEditCharacter, onUploadClick, onSaveClick, campaignName, activeMapName, characters, onLongRest, exhaustionLevel, conditionEffects, onConditionsChange, auraComboEffects }) {
    const { setPopupHtml } = useDiceRollPopup();
    const { rollInitiative } = useLoggedDiceRoll(playerStats.name, campaignName);
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
        setRuntimeValue(playerStats.name, 'xp', newXp, campaignName);
        setShowXpModal(false);
    };

    const handleXpModeToggle = (e) => {
        const newMode = e.target.checked ? 'milestone' : 'experience';
        playerStats.xpMode = newMode;
        setRuntimeValue(playerStats.name, 'xpMode', newMode, campaignName);
        setShowXpModal(false);
    };

    const storedBuffs = getActiveBuffs(playerStats.name, campaignName);
    const activeBuffs = useRuntimeValue(playerStats.name, 'activeBuffs', campaignName) ?? storedBuffs;
    const flyBuff = Array.isArray(activeBuffs) ? activeBuffs.find(b => b.effect === 'fly_speed_equals_walk_speed') : null;
    const flyBuffActive = !!flyBuff;
    const flyBuffName = flyBuff?.name || '';

    // Circle Forms AC override: 13 + WIS modifier when shape_shift is active for Circle of the Moon
    const isMoonDruid = playerStats.class?.major?.name === 'Moon' || playerStats.class?.subclass?.name === 'Moon';
    const shapeShiftActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'shape_shift' || b.effect === 'large_form');
    let circleFormsACOverride = null;
    if (isMoonDruid && shapeShiftActive) {
        const wis = playerStats.abilities.find(a => a.name === 'Wisdom');
        const wisMod = wis?.bonus ?? 0;
        circleFormsACOverride = 13 + wisMod;
    }
    let speed = playerStats.race.subrace && playerStats.race.subrace.speed ? playerStats.race.subrace.speed : playerStats.race.speed;

    // Check if character is wearing armor or wielding a shield (for Unarmored Movement)
    const equippedItems = playerStats.inventory?.equipped || [];
    const allEquipment = playerStats.equipment || [];
    let isWearingArmor = false;
    let isWieldingShield = false;
    for (const itemName of equippedItems) {
        const parsedName = parseMagicItemName(itemName);
        const baseName = parsedName.baseName;
        const item = allEquipment.find(eq => eq.name === baseName);
        if (item && item.equipment_category === 'Armor') {
            isWearingArmor = true;
            break;
        }
        if (baseName === 'Shield') {
            isWieldingShield = true;
            break;
        }
    }
    const hasArmorOrShield = isWearingArmor || isWieldingShield;

    if (playerStats.class.name === 'Monk') {
        const { classRules: cr } = rulesFactory.getRules(playerStats);
        if (typeof cr.getUnarmoredMovementIncrease === 'function') {
            const unarmoredMovementIncrease = cr.getUnarmoredMovementIncrease(playerStats);
            if (!hasArmorOrShield) {
                speed += unarmoredMovementIncrease;
            }
         }
     }
        if (playerStats.class.name === 'Barbarian') {
        const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
        const unarmoredMovement = classLevel?.class_specific?.unarmored_movement || 0;
        if (!hasArmorOrShield) {
            speed += unarmoredMovement;
        }
      }

    // Apply passive_buff speed_bonus effects (e.g., Fast Movement: +10 speed without heavy armor)
    let buffSpeedBonus = 0;
    const passives = playerStats.automation?.passives || [];
    for (const passive of passives) {
      if (passive.type === 'passive_buff' && passive.effect === 'speed_bonus') {
        const bonus = passive.bonusExpression ? parseInt(passive.bonusExpression, 10) : 10;
        if (passive.condition === 'no_heavy_armor') {
          const isWearingHeavy = playerStats.equipment
            ? playerStats.equipment.find(eq => playerStats.inventory.equipped?.includes(eq.name) && eq.armor_category === 'Heavy')
            : (playerStats.armorClassFormula?.includes('Heavy') || false);
          if (!isWearingHeavy) {
            buffSpeedBonus += bonus;
          }
        } else if (passive.condition === 'no_armor_no_shield') {
          if (!hasArmorOrShield) {
            buffSpeedBonus += bonus;
          }
        }
      }
      if (passive.type === 'passive_buff' && passive.effect === 'speed_increase' && passive.bonusExpression) {
        const bonus = parseInt(passive.bonusExpression, 10);
        if (!isNaN(bonus)) {
          buffSpeedBonus += bonus;
        }
      }
    }

    speed = Math.max(0, speed - (5 * exhaustionLevel));
    if (conditionEffects?.speedZero) speed = 0;
    if (conditionEffects?.speedHalved) speed = Math.floor(speed / 2);
    if (conditionEffects?.speedReduction) speed = Math.max(0, speed - conditionEffects.speedReduction);
    const auraSpeedBonus = auraComboEffects?.speedBonus || 0;
    const auraSpeedSource = auraComboEffects?.speedSource || null;
    const totalSpeed = speed + auraSpeedBonus;

    const baseImmunities = playerStats.immunities || [];
    const auraImmunities = auraComboEffects?.immunities || [];
    const auraImmunitySources = auraComboEffects?.immunitySources || {};
    const allImmunities = [...new Set([...baseImmunities, ...auraImmunities])];

    const baseResistances = playerStats.resistances || [];
    const auraResistances = auraComboEffects?.resistances || [];
    const auraResistanceSource = auraComboEffects?.resistanceSource || null;

    const stormbornResistances = (playerStats.automation?.passives || [])
        .filter(p => p.type === 'resistance' && p.name === 'Stormborn')
        .flatMap(p => p.damageTypes || []);

    const wrathOfTheSeaActive = useRuntimeValue(playerStats.name, 'wrathOfTheSeaActive', campaignName);
    const stormbornResistancesActive = wrathOfTheSeaActive && stormbornResistances.length > 0
        ? stormbornResistances
        : [];

    const rageResistances = Array.isArray(activeBuffs)
        ? activeBuffs.filter(b => b.name === 'Rage').flatMap(b => b.resistanceTypes || [])
        : [];

    const allResistances = [...new Set([...baseResistances, ...auraResistances, ...stormbornResistancesActive, ...rageResistances])];

    let flySpeed = null;
    let swimSpeed = null;
    let hasteAcBonus = 0;
    let shieldAcBonus = 0;
    let baitAndSwitchBonus = 0;
    let shieldOfFaithBonus = 0;
    let mageArmorActive = false;
    let iceWalkActive = false;
    let acrobaticMovementActive = false;
    let seeInvisibleRange = null;
    let narrowSpaceActive = false;
    let glisteningFlightHover = false;
    let dragonWingsHover = false;
    let tremorsenseActive = false;
    const thirdEyeBuff = Array.isArray(activeBuffs) ? (activeBuffs.find(b => b.name === 'The Third Eye') || null) : null;
    const thirdEyeEffect = thirdEyeBuff?.effect || null;
    const huntersMarkActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.name === "Hunter's Mark");
    activeBuffs.forEach(buff => {
        if (buff.effect === 'fly_speed_equals_walk_speed' || buff.flySpeed) flySpeed = speed;
        if (buff.effect === 'fly_speed_20_hover') flySpeed = 20;
        if (buff.effect === 'telekinetic_leap') flySpeed = buff.flySpeed;
        if (buff.effect === 'avenging_angel_flight') flySpeed = buff.flySpeed || 60;
        if (buff.effect === 'speed_boost' && buff.speedBonus) buffSpeedBonus += buff.speedBonus;
        if (buff.effect === 'large_form') buffSpeedBonus += 10;
        if (buff.effect === 'mage_armor') mageArmorActive = true;
        if (buff.effect === 'shield') shieldAcBonus = 5;
        if (buff.effect === 'ice_walk') iceWalkActive = true;
        if (buff.effect === 'glistening_flight') { flySpeed = speed; glisteningFlightHover = true; }
        if (buff.effect === 'dragon_wings') { flySpeed = buff.flySpeed || 60; dragonWingsHover = true; }
        if (buff.effect === 'aquatic_adaptation') swimSpeed = speed * 2;
        if (buff.effect === 'see_the_invisible') seeInvisibleRange = 60;
        if (buff.effect === 'see_invisibility') seeInvisibleRange = 120;
        if (buff.effect === 'wormhole_movement') narrowSpaceActive = true;
        if (buff.effect === 'tremorsense_60ft') tremorsenseActive = true;
    });
    const hasteActive = activeBuffs.some(b => b.effect === 'haste');
    if (hasteActive) {
        speed = speed * 2;
        hasteAcBonus = 2;
    }
    const shieldOfFaithActive = activeBuffs.some(b => b.effect === 'shield_of_faith');
    if (shieldOfFaithActive) {
        shieldOfFaithBonus = 2;
    }
    const baitAndSwitchActive = useRuntimeValue(playerStats.name, 'baitAndSwitchActive', campaignName);
    const baitAndSwitchBonusValue = useRuntimeValue(playerStats.name, 'baitAndSwitchBonus', campaignName);
    const baitAndSwitchSource = useRuntimeValue(playerStats.name, 'baitAndSwitchSource', campaignName);
    if (baitAndSwitchActive && baitAndSwitchBonusValue) {
        baitAndSwitchBonus = Number(baitAndSwitchBonusValue);
    }
    const acrobaticMovementPassive = (playerStats.automation?.passives || []).find(p => p.effect === 'acrobatic_movement');
    if (acrobaticMovementPassive && !hasArmorOrShield) {
        acrobaticMovementActive = true;
    }
    const elementalMovementPassive = (playerStats.passives || []).find(p => p.effect === 'elemental_attunement_movement');
    if (elementalMovementPassive) {
        flySpeed = speed;
        swimSpeed = speed;
    }
    const aquaticAffinityPassive = (playerStats.automation?.passives || []).find(p => p.effect === 'aquatic_affinity');
    if (aquaticAffinityPassive && swimSpeed === null) {
        swimSpeed = speed;
    }
    const stormbornPassive = (playerStats.automation?.passives || []).find(p => p.effect === 'fly_speed_equals_walk_speed');
    if (stormbornPassive && flySpeed === null && wrathOfTheSeaActive) {
        flySpeed = speed;
    }
    const totalSpeedWithBuff = totalSpeed + buffSpeedBonus;

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
             <div className='char-header'>
                 <AvatarImage name={playerStats.name} imagePath={playerStats.imagePath} campaignName={campaignName} size={60} onClick={() => setShowAvatarModal(true)} />
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
                    <div className='clickable' onClick={showArmorClassFormulaPopup}><b>Armor Class: </b>{circleFormsACOverride ?? (playerStats.armorClass + hasteAcBonus + shieldAcBonus + baitAndSwitchBonus + shieldOfFaithBonus + (conditionEffects?.wardingBondAcBonus || 0) - (conditionEffects?.acPenalty || 0))}{(hasteAcBonus > 0 || mageArmorActive || shieldAcBonus > 0 || shieldOfFaithBonus > 0) && <span className="aura-source" title={mageArmorActive ? "From Mage Armor" : undefined}>{hasteAcBonus > 0 && ` (+${hasteAcBonus} from Haste)`}{mageArmorActive && ' (+3 from Mage Armor)'}</span>}{shieldAcBonus > 0 && <span className="aura-source" title="From Shield"> (+5 from Shield)</span>}{shieldOfFaithBonus > 0 && <span className="aura-source" title="From Shield of Faith"> (+2 from Shield of Faith)</span>}{baitAndSwitchBonus > 0 && <span className="aura-source" title={`From ${baitAndSwitchSource || 'Bait and Switch'}`}> (+{baitAndSwitchBonus} from {baitAndSwitchSource || 'Bait and Switch'})</span>}{(conditionEffects?.wardingBondAcBonus || 0) > 0 && <span className="aura-source" title="From Warding Bond"> (+{conditionEffects.wardingBondAcBonus} from Warding Bond)</span>}{(conditionEffects?.acPenalty || 0) > 0 && <span className="stat--penalized" title="Slow spell penalty"> ({'−'}{conditionEffects.acPenalty} from Slow)</span>}</div>
                    <CharHitPoints playerStats={playerStats} campaignName={campaignName}></CharHitPoints>
                      <b>Speed: </b><span className={exhaustionLevel > 0 || conditionEffects?.speedZero ? 'stat--penalized' : ''}>{totalSpeedWithBuff} ft.{playerStats.climbSpeed ? `, climb ${playerStats.climbSpeed} ft.` : ''}{swimSpeed !== null ? `, swim ${swimSpeed} ft.` : ''}{flySpeed !== null ? `, fly ${flySpeed + auraSpeedBonus} ft. ${(glisteningFlightHover || dragonWingsHover) ? ' (hover)' : ''}` : ''}{iceWalkActive ? ', ice walk' : ''}{acrobaticMovementActive ? ', acrobatic movement' : ''}</span> {auraSpeedBonus > 0 && auraSpeedSource && <span className="aura-source" title={`From ${auraSpeedSource}'s Aura of Alacrity`}> (+{auraSpeedBonus})</span>}<br />
                    <CharGold playerStats={playerStats} campaignName={campaignName}></CharGold>
                </div>
                <div>
                    <b>Proficiency: </b>+{playerStats.proficiency}<br />
                    <span className={'clickable' + (exhaustionLevel > 0 ? ' stat--penalized' : '')} onClick={() => rollInitiative(effectiveInitiative, playerStats.initiativeAdvantage ? { forcedMode: 'advantage' } : undefined)}><b>Initiative: </b>{signFormatter.format(effectiveInitiative)}</span><br />
                    <b>Inspiration: </b><input tabIndex={0} type="checkbox" checked={hasInspiration} onChange={handleToggleInspiration} /><br />
                    {playerStats.background && <div><b>Background: </b><span className="clickable" onClick={() => showBackgroundPopup(playerStats.background, setPopupHtml, playerStats.rules || '5e')}>{playerStats.background}</span></div>}
                    <CharFeats playerStats={playerStats} showPopup={(feat) => {
                                             if (feat.desc || feat.description) {
                            // Handle both array (5e) and string (2024) description formats
                             let descriptionHtml;
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
                    {flyBuffActive && <span className="automation-badge">{flyBuffName} Active</span>}
                    {huntersMarkActive && <span className="automation-badge">Hunter's Mark Active</span>}
                    {seeInvisibleRange && <span className="automation-badge">See Invisible {seeInvisibleRange} ft</span>}
                    {thirdEyeEffect === 'darkvision_120' && <span className="automation-badge">Darkvision 120 ft</span>}
                    {thirdEyeEffect === 'greater_comprehension' && <span className="automation-badge">Greater Comprehension (read any language)</span>}
                    {narrowSpaceActive && <span className="automation-badge">Narrow Space</span>}
                    {tremorsenseActive && <span className="automation-badge">Tremorsense 60 ft.</span>}
                </div>
                <div>
                      <CharClassFeatures playerStats={playerStats} campaignName={campaignName} />
                </div>
      </div>
          {allResistances.length > 0 && <div>
              <b>Resistances: </b>
              {allResistances.map((r, i) => (
                <span key={r}>
                  {i > 0 ? ', ' : ''}{r}
                  {auraResistances.includes(r) && auraResistanceSource && <span className="aura-source" title={`From ${auraResistanceSource}'s Aura of Warding`}>*</span>}
                </span>
              ))}
          </div>}
          {allImmunities.length > 0 && <div>
              <b>Immunities: </b>
              {allImmunities.map((imm, i) => (
                <span key={imm}>
                  {i > 0 ? ', ' : ''}{imm.charAt(0).toUpperCase() + imm.slice(1)}
                  {auraImmunities.includes(imm) && auraImmunitySources[imm] && <span className="aura-source" title={`From ${auraImmunitySources[imm]}'s aura`}>*</span>}
                </span>
              ))}
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
                    campaignName={campaignName}
                    onClose={() => setShowAvatarModal(false)}
                />
            )}
              <CharConditions playerStats={playerStats} campaignName={campaignName} activeMapName={activeMapName} characters={characters} exhaustionLevel={exhaustionLevel} onConditionsChange={onConditionsChange} conditionEffects={conditionEffects} />
            </div>
  </div>
)
}

export default CharSummary
