
import React from 'react'
import './CharSummary.css'

import { isAuraOfLifeActive } from '../../../services/automation/handlers/buffs/auraOfLifeHandler.js'
import { isCircleOfPowerActive } from '../../../services/automation/handlers/buffs/circleOfPowerHandler.js'
import { isDeathWardActive } from '../../../services/automation/handlers/buffs/deathWardHandler.js'
import CharGold from './CharGold.jsx'
import CharHitPoints from './CharHitPoints.jsx'
import CharClassFeatures from './CharClassFeatures.jsx'
import CharRaceFeatures from './CharRaceFeatures.jsx'
import CharFeatFeatures from './CharFeatFeatures.jsx'
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
import { setRuntimeValue, useRuntimeValue, getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { useSyncedState } from '../../../hooks/runtime/useSyncedState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { addEntry } from '../../../services/ui/logService.js';
import CharConditions from './CharConditions.jsx'
import AllySelectionModal from '../../common/AllySelectionModal.jsx'
import TrackedResourceInput from './TrackedResourceInput.jsx';
import CreatureBadge from '../../common/CreatureBadge.jsx'
import ConditionEffectBadges from '../../initiative/ConditionEffectBadges.jsx'
import { isBuffActive } from '../../../services/automation/common/buffToggle.js';
import { isUnbreakableMajestyActive, getUnbreakableMajestySaveDc } from '../../../services/combat/auras/unbreakableMajesty.js';
import { computeCharSummaryContext } from './charSummaryCalc.js';

const signFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'always' });

function CharSummary({ playerStats, onDeleteCharacter, onEditCharacter, onUploadClick, onSaveClick, campaignName, activeMapName, characters, onLongRest, exhaustionLevel, conditionEffects, onConditionsChange, auraComboEffects }) {
    const { setPopupHtml } = useDiceRollPopup();
    const { rollInitiative } = useLoggedDiceRoll(playerStats.name, campaignName, { characters });
    const [showShortRest, setShowShortRest] = React.useState(false);
    const [showXpModal, setShowXpModal] = React.useState(false);
    const [xpDelta, setXpDelta] = React.useState('');
    const [displayXp, setDisplayXp] = React.useState(playerStats?.xp ?? 0);
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const [showAvatarModal, setShowAvatarModal] = React.useState(false);
    const [showAllyModal, setShowAllyModal] = React.useState(false);
    const [allyModalCreatures, setAllyModalCreatures] = React.useState([]);
    const storedAllies = useRuntimeValue(playerStats.name, 'selectedAllies', campaignName);
    const [surgeEffects, setSurgeEffects] = useSyncedState(playerStats.name, 'wildMagicSurgeEffects', null, campaignName);
    const currentAllies = Array.isArray(storedAllies) && storedAllies.length > 0 ? storedAllies : [playerStats.name];
    React.useEffect(() => {
        const handleInitiative = () => {
            setSurgeEffects(null);
        };
        window.addEventListener('initiative-rolled', handleInitiative);
        return () => window.removeEventListener('initiative-rolled', handleInitiative);
    }, [playerStats.name, campaignName, setSurgeEffects]);

    // CLA-226: Special Actions "Memorize Spell:" row opens the Short Rest swap UI.
    React.useEffect(() => {
        const handleOpenShortRest = () => setShowShortRest(true);
        window.addEventListener('open-short-rest', handleOpenShortRest);
        return () => window.removeEventListener('open-short-rest', handleOpenShortRest);
    }, []);

    React.useEffect(() => {
        setDisplayXp(playerStats?.xp ?? 0);
    }, [playerStats?.xp]);

    const isInXpMode = (playerStats?.xpMode || 'milestone') === 'experience';

    // Reactive cover refresh — triggers re-render when any cover-relevant runtime value changes
    // Subscribe to all character stores that might have cover-relevant values
    const coverRefresh = useSyncedState(playerStats.name, 'smiteOfProtectionActive', null, campaignName);
    const bulwarkOfForceActive = useSyncedState(playerStats.name, 'bulwarkOfForceActive', null, campaignName);
    const naturesSanctuaryActive = useSyncedState(playerStats.name, 'naturesSanctuaryActive', null, campaignName);
    const bulwarkOfForceTargets = useSyncedState(playerStats.name, 'bulwarkOfForceTargets', null, campaignName);
    const naturesSanctuaryCreatures = useSyncedState(playerStats.name, 'naturesSanctuaryCreatures', null, campaignName);
    const mantleOfMajestyActive = useSyncedState(playerStats.name, 'mantleOfMajestyActive', null, campaignName);
    const innerRadianceActive = useSyncedState(playerStats.name, 'innerRadianceActive', null, campaignName);
    const unbreakableMajestyActive = useSyncedState(playerStats.name, 'unbreakableMajestyActive', null, campaignName);
    // Also subscribe to campaign-level cover refresh to catch changes from other characters
    const coverRefreshCampaign = useSyncedState('campaign', 'coverRefresh', 0, campaignName);
    void [coverRefresh, bulwarkOfForceActive, naturesSanctuaryActive, bulwarkOfForceTargets, naturesSanctuaryCreatures, mantleOfMajestyActive, unbreakableMajestyActive, coverRefreshCampaign];

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


    const ctx = computeCharSummaryContext(playerStats, campaignName, characters, conditionEffects, auraComboEffects, exhaustionLevel);
    const {
        flyBuffActive, flyBuffName, circleFormsACOverride, auraSpeedBonus, auraSpeedSource,
        allImmunities, allResistances, auraResistances, auraResistanceSource,
        flySpeed, swimSpeed, climbSpeed, seeInvisibilityActive,
        hasteAcBonus, shieldAcBonus, baitAndSwitchBonus, shieldOfFaithBonus, defensiveDuelistBonus,
        barkskinActive, mageArmorActive, mageArmorAc, iceWalkActive, acrobaticMovementActive,
        glisteningFlightHover, dragonWingsHover, starryFormHover, tremorsenseActive, largeFormActive,
        huntersMarkActive, dexBonus, baitAndSwitchSource, smiteOfProtectionCoverActive, bulwarkOfForceCoverActive,
        naturesSanctuaryCoverActive, effectiveInitiative, totalSpeedWithBuff,
        wrathOfTheSeaActive, heroesFeastResistances, heroesFeastConditionImmunities,
    } = ctx;
    const allTargetEffects = useRuntimeValue('campaign', 'targetEffects');
    const myTargetEffects = React.useMemo(() => {
        const effects = allTargetEffects || [];
        const filtered = effects.filter(te => {
            const teTarget = Array.isArray(te.target) ? te.target[0] : te.target;
            return teTarget === playerStats.name;
        });
        return filtered;
    }, [allTargetEffects, playerStats.name]);
    const rawConditions = useRuntimeValue(playerStats.name, 'activeConditions');
    const rawConditionMeta = useRuntimeValue(playerStats.name, 'activeConditionMeta');
    const conditionObjects = React.useMemo(() => {
        const storedConditions = rawConditions ?? [];
        const conditionMeta = rawConditionMeta ?? {};
        return storedConditions.map((key, i) => {
            const condKey = String(key).toLowerCase();
            const meta = conditionMeta[condKey] || {};
            return {
                id: `runtime-${key}-${i}`,
                key,
                label: key.charAt(0).toUpperCase() + key.slice(1),
                dc: meta.dc || 0,
                ability: meta.ability || 'con',
            };
        });
    }, [rawConditions, rawConditionMeta]);

    const rawCombatSummary = getCombatSummary(campaignName);
    const rawCreaturesForBadges = rawCombatSummary?.creatures;
    const playerCreatureForBadges = (rawCreaturesForBadges || []).find(c => c.name === playerStats.name);
    const concentrationForBadges = playerCreatureForBadges?.concentration ?? null;
    const wildShapeActiveChar = isBuffActive(playerStats.name, 'Wild Shape', campaignName);
    const isMajestyActiveChar = isUnbreakableMajestyActive(playerStats.name, campaignName);
    const majestyDcChar = isMajestyActiveChar ? getUnbreakableMajestySaveDc(playerStats.name, campaignName) : 0;
    const recklessAttackActiveChar = myTargetEffects.some(te => te.effect === 'reckless_attack');

    const sanctuaryInfoChar = React.useMemo(() => {
        const creatures = rawCreaturesForBadges || [];
        for (const other of creatures) {
            if (other.type !== 'player') continue;
            const active = getRuntimeValue(other.name, 'naturesSanctuaryActive', campaignName);
            if (!active) continue;
            const creatureList = getRuntimeValue(other.name, 'naturesSanctuaryCreatures', campaignName) || [];
            if (creatureList.includes(playerStats.name)) {
                const resistance = getRuntimeValue(other.name, 'naturesSanctuaryResistance', campaignName) || 'None';
                return { druid: other.name, resistance };
            }
        }
        return null;
    }, [rawCreaturesForBadges, campaignName, playerStats?.name]);

    const allCreaturesForBadges = rawCreaturesForBadges || [];
    const huntersMarkOnCreature = allCreaturesForBadges?.some(c => c.concentration?.spell === "Hunter's Mark" && c.concentration?.target === playerStats.name);
    const markCreature = huntersMarkOnCreature ? allCreaturesForBadges.find(c => c.concentration?.spell === "Hunter's Mark" && c.concentration?.target === playerStats.name) : null;

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

    const handleInitiative = () => {
        rollInitiative(effectiveInitiative, playerStats.initiativeAdvantage ? { forcedMode: 'advantage' } : undefined);
    };

    const handleAllyModalOpen = () => {
        const combatSummary = getCombatSummary(campaignName);
        const targets = combatSummary?.creatures?.map(c => ({
            name: c.name,
            type: c.type,
            currentHp: c.currentHp,
            maxHp: c.maxHp,
        })) || characters.map(c => ({ name: c.name, type: c.type }));
        setAllyModalCreatures(targets);
        setShowAllyModal(true);
    };

    const handleAllyModalConfirm = async (selectedAllies) => {
        setShowAllyModal(false);
        setRuntimeValue(playerStats.name, 'selectedAllies', selectedAllies, campaignName);
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Ally Selection',
            description: `${playerStats.name} selected allies: ${selectedAllies.join(', ')}`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[CharSummary] Error logging ally selection:', e); });
    };

    const handleAllyModalCancel = () => {
        setShowAllyModal(false);
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
                        <div className='char-btn-group no-print'>
                            <button className="char-btn" onClick={onEditCharacter} title="Edit Character"><i className="fas fa-pen"></i> Edit</button>
                            <button className="char-btn" onClick={handleDeleteCharacter} title="Delete Character">Delete</button>
                            <button className="char-btn" onClick={onUploadClick} title="Upload Character"><i className="fas fa-arrow-up"></i> Upload</button>
                            <button className="char-btn" onClick={onSaveClick} title="Download Character"><i className="fas fa-arrow-down"></i> Download</button>
                            <ShortRestButton onClick={() => setShowShortRest(true)} />
                            <LongRestButton playerStats={playerStats} campaignName={campaignName} onLongRest={onLongRest} />
                        </div>
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
                     <div className='clickable' onClick={showArmorClassFormulaPopup}><b>Armor Class: </b>{circleFormsACOverride ?? (barkskinActive ? 17 : (mageArmorActive ? mageArmorAc + dexBonus + hasteAcBonus + shieldAcBonus + baitAndSwitchBonus + shieldOfFaithBonus + defensiveDuelistBonus + (conditionEffects?.wardingBondAcBonus || 0) - (conditionEffects?.acPenalty || 0) : (playerStats.armorClass + hasteAcBonus + shieldAcBonus + baitAndSwitchBonus + shieldOfFaithBonus + defensiveDuelistBonus + (conditionEffects?.wardingBondAcBonus || 0) - (conditionEffects?.acPenalty || 0))))}{(hasteAcBonus > 0 || mageArmorActive || shieldAcBonus > 0 || shieldOfFaithBonus > 0 || defensiveDuelistBonus > 0 || barkskinActive) && <span className="aura-source" title={mageArmorActive ? `From Mage Armor (13 + ${dexBonus} Dex)` : undefined}>{hasteAcBonus > 0 && ` (+${hasteAcBonus} from Haste)`}{mageArmorActive && ` (${mageArmorAc} + ${dexBonus} Dex)`}</span>}{shieldAcBonus > 0 && <span className="aura-source" title="From Shield"> (+5 from Shield)</span>}{shieldOfFaithBonus > 0 && <span className="aura-source" title="From Shield of Faith"> (+2 from Shield of Faith)</span>}{defensiveDuelistBonus > 0 && <span className="aura-source" title="From Defensive Duelist"> (+{defensiveDuelistBonus} from Defensive Duelist)</span>}{baitAndSwitchBonus > 0 && <span className="aura-source" title={`From ${baitAndSwitchSource || 'Bait and Switch'}`}> (+{baitAndSwitchBonus} from {baitAndSwitchSource || 'Bait and Switch'})</span>}{barkskinActive && <span className="aura-source" title="From Barkskin"> (AC 17 from Barkskin)</span>}{(conditionEffects?.wardingBondAcBonus || 0) > 0 && <span className="aura-source" title="From Warding Bond"> (+{conditionEffects.wardingBondAcBonus} from Warding Bond)</span>}{(conditionEffects?.acPenalty || 0) > 0 && <span className="stat--penalized" title="Slow spell penalty"> ({'−'}{conditionEffects.acPenalty} from Slow)</span>}{smiteOfProtectionCoverActive && <span className="aura-source cover-badge" title="Half Cover from Smite of Protection — applies to all attackers while in Aura of Protection"> (+2 Cover: Smite of Protection)</span>}{bulwarkOfForceCoverActive && <span className="aura-source cover-badge" title="Half Cover from Bulwark of Force — applies to all attackers"> (+2 Cover: Bulwark of Force)</span>}{naturesSanctuaryCoverActive && <span className="aura-source cover-badge" title="Half Cover from Nature's Sanctuary — applies to all attackers"> (+2 Cover: Nature's Sanctuary)</span>}</div>
                    <CharHitPoints playerStats={playerStats} campaignName={campaignName} isLocalhost={isLocalhost}></CharHitPoints>
                      <b>Speed: </b><span className={exhaustionLevel > 0 || conditionEffects?.speedZero ? 'stat--penalized' : ''}>{totalSpeedWithBuff} ft.{climbSpeed ? `, climb ${climbSpeed} ft.` : ''}{swimSpeed !== null ? `, swim ${swimSpeed} ft.` : ''}{flySpeed !== null ? `, fly ${flySpeed + auraSpeedBonus} ft. ${(glisteningFlightHover || dragonWingsHover || starryFormHover) ? ' (hover)' : ''}` : ''}{iceWalkActive ? ', ice walk' : ''}{acrobaticMovementActive ? ', acrobatic movement' : ''}</span> {auraSpeedBonus > 0 && auraSpeedSource && <span className="aura-source" title={`From ${auraSpeedSource}'s Aura of Alacrity`}> (+{auraSpeedBonus})</span>}{conditionEffects?.speedHalved && <span className="stat--penalized" title="Slow spell penalty"> (Speed halved from Slow)</span>}<br />
                    <CharGold playerStats={playerStats} campaignName={campaignName}></CharGold>
                </div>
                <div>
                    <b>Proficiency: </b>+{playerStats.proficiency}<br />
                    <span className={'clickable' + (exhaustionLevel > 0 ? ' stat--penalized' : '')} onClick={handleInitiative}><b>Initiative: </b>{signFormatter.format(effectiveInitiative)}</span><br />
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
                    <span className="ally-badge clickable no-print" onClick={handleAllyModalOpen} title="Manage allies">
                        <i className="fa-solid fa-users"></i> Allies ({currentAllies.length})
                    </span>
                    {flyBuffActive && <CreatureBadge icon='fa-feather' label={`${flyBuffName} Active`} cls='effect-buff' />}
                    {largeFormActive && <CreatureBadge icon='fa-expand' label='Large Form' cls='effect-buff' />}
                    {huntersMarkActive && <CreatureBadge icon='fa-crosshairs' label="Hunter's Mark Active" cls='effect-neutral' />}
                    {tremorsenseActive && <CreatureBadge icon='fa-ear' label='Tremorsense 60 ft.' cls='effect-buff' />}
                </div>
                <div>
                    <TrackedResourceInput label="Short Rest Hit Dice" resourceKey="shortRestHitDice" playerName={playerStats.name} getMax={() => playerStats.level} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
                    <CharClassFeatures playerStats={playerStats} campaignName={campaignName} />
                      <CharFeatFeatures playerStats={playerStats} campaignName={campaignName} />
                      <CharRaceFeatures playerStats={playerStats} campaignName={campaignName} />
                </div>
      </div>
          {allResistances.length > 0 && <div>
              <b>Resistances: </b>
              {allResistances.filter(r => typeof r === 'string').map((r, i) => (
                <span key={r}>
                  {i > 0 ? ', ' : ''}{r.charAt(0).toUpperCase() + r.slice(1)}
                  {auraResistances.includes(r) && auraResistanceSource && <span className="aura-source" title={`From ${auraResistanceSource}'s Aura of Warding`}>*</span>}
                </span>
              ))}
          </div>}
          {allImmunities.length > 0 && <div>
              <b>Immunities: </b>
              {allImmunities.filter(imm => typeof imm === 'string').map((imm, i) => (
                <span key={imm}>
                  {i > 0 ? ', ' : ''}{imm.charAt(0).toUpperCase() + imm.slice(1)}

                </span>
              ))}
          </div>}
          {playerStats.vulnerabilities != null && playerStats.vulnerabilities.length > 0 && <span><b>Vulnerabilities: </b>{playerStats.vulnerabilities.join(', ')}</span>}
            {playerStats.senses != null && playerStats.senses.length > 0 && <div><b>Senses: </b>{[...playerStats.senses.map((sense) => `${sense.name} ${sense.value}`), ...(seeInvisibilityActive ? ['See Invisibility'] : [])].join(', ')}</div>}
            {playerStats.proficiencies?.length > 0 && <div><b>Proficiencies: </b>{[...playerStats.proficiencies.filter(p => !/^(\d+) from: (.+)$/.test(p)), ...(playerStats.toolProficiencies || [])].join(', ')}</div>}
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
                <div className='char-summary-badges'>
                    <CharConditions playerStats={playerStats} campaignName={campaignName} activeMapName={activeMapName} characters={characters} exhaustionLevel={exhaustionLevel} onConditionsChange={onConditionsChange} conditionEffects={conditionEffects} />
                    <ConditionEffectBadges conditions={conditionObjects} targetEffects={myTargetEffects} creatureName={playerStats.name} campaignName={campaignName} allCreatures={allCreaturesForBadges} isLocalhost={isLocalhost} />
                    {wildShapeActiveChar && (
                        <CreatureBadge icon='fa-paw' label='Wild Shape' cls='effect-buff' tooltip='Wild Shape: Animal form active — spellcasting blocked, resistance types apply' />
                    )}
                    {(() => {
                        const starryBuffs = getRuntimeValue(playerStats.name, 'activeBuffs') || [];
                        const starryFormBuff = Array.isArray(starryBuffs) ? starryBuffs.find(b => b.name === 'Starry Form' && b.constellation) : null;
                        if (!starryFormBuff) return null;
                        const constellation = starryFormBuff.constellation;
                        return (
                            <CreatureBadge icon='fa-star' label={`Starry Form - ${constellation}`} cls='effect-buff' tooltip={`Starry Form (${constellation} constellation): Luminous form active — Resistance to Bludgeoning, Piercing, and Slashing damage${constellation === 'Archer' ? '; Bonus Action: Luminous Arrow attack' : constellation === 'Chalice' ? '; Healing spells restore extra HP to allies within 30 feet' : '; Concentration checks: Treat d20 rolls of 9 or lower as 10'}`} />
                        );
                    })()}
                    {isAuraOfLifeActive(playerStats.name, campaignName) && (
                        <CreatureBadge icon='fa-heart-pulse' label='Aura of Life' cls='effect-buff' tooltip={'Aura of Life: Resistance to Necrotic damage, HP maximum can\'t be reduced, regain 1 HP at start of turn if at 0 HP'} />
                    )}
                    {isCircleOfPowerActive(playerStats.name, campaignName) && (
                        <CreatureBadge icon='fa-shield-halved' label='Circle of Power' cls='effect-buff' tooltip='Circle of Power: Advantage on saving throws against spells and other magical effects. No damage on a successful save vs half-damage effects.' />
                    )}
                    {isMajestyActiveChar && (
                        <CreatureBadge icon='fa-shield-halved' label={`Majesty DC ${majestyDcChar}`} cls='effect-buff' tooltip={`Unbreakable Majesty (DC ${majestyDcChar})\n\nFirst attack per turn that hits forces attacker to make a CHA save or the attack misses.`} />
                    )}
                    {wrathOfTheSeaActive && (
                        <CreatureBadge icon='fa-water' label='Wrath of the Sea' cls='effect-buff' tooltip='Wrath of the Sea: Ocean spray emanation active — Bonus Action to force CON save or take WIS modifier d6 Cold damage' />
                    )}
                    {sanctuaryInfoChar && (
                        <CreatureBadge icon='fa-leaf' label='Sanctuary' cls='effect-buff' tooltip={`Nature's Sanctuary: Half Cover (AC +2), ${sanctuaryInfoChar.resistance} resistance. Protected by ${sanctuaryInfoChar.druid}'s Nature's Sanctuary`} />
                    )}
                    {recklessAttackActiveChar && (
                        <CreatureBadge icon='fa-shield-halved' label='Reckless Attack' cls='effect-debuff' tooltip='Reckless Attack: Advantage on Strength attack rolls, attack rolls against you have Advantage' />
                    )}
                    {concentrationForBadges && (
                        <CreatureBadge icon='fa-spinner' label={`${concentrationForBadges.spell} DC ${concentrationForBadges.dc}`} cls='effect-neutral' tooltip={`Concentration: ${concentrationForBadges.spell} (DC ${concentrationForBadges.dc} Constitution)`} />
                    )}
                    {barkskinActive && (
                        <CreatureBadge icon='fa-tree' label='Barkskin (AC 17)' cls='effect-buff' tooltip='Barkskin: AC set to 17. Concentration, up to 1 hour.' />
                    )}
                    {huntersMarkOnCreature && markCreature && (
                        <CreatureBadge icon='fa-crosshairs' label="Hunter's Mark" cls='effect-neutral' tooltip={`Marked by ${markCreature?.name}`} />
                    )}
                    {isDeathWardActive(playerStats.name, campaignName) && (
                        <CreatureBadge icon='fa-shield-halved' label='Death Ward' cls='effect-buff' tooltip='Death Ward: Protected from death. First time target would drop to 0 HP, drops to 1 HP instead. Spell ends.' />
                    )}

                    {heroesFeastResistances.length > 0 && (
                         <CreatureBadge icon='fa-champagne-glasses' label="Heroes' Feast" cls='effect-buff' tooltip={`Heroes' Feast: Resistance to ${heroesFeastResistances.join(', ')}, Immune to ${heroesFeastConditionImmunities.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')}, HP maximum increased by 2d10. Lasts 24 hours.`} />
                    )}
                    {innerRadianceActive && (
                        <CreatureBadge icon='fa-sun' label='Inner Radiance' cls='effect-buff' tooltip='Inner Radiance: Bright Light 10 ft, Dim Light 10 ft more. At the end of each of your turns, each creature within 10 feet takes Radiant damage equal to your Proficiency Bonus.' />
                    )}
                </div>
              </div>
               {surgeEffects && Array.isArray(surgeEffects) && surgeEffects.length > 0 && (
                   <div className="wild-surge-badge">
                       <b>Surge Effects: </b>
                       <ul className="wild-surge-effects-list">
                           {surgeEffects.map((surge, index) => (
                               <li key={surge.timestamp || index} className="wild-surge-badge-name" title={surge.effect}>
                                   {surge.roll === 'tamed' ? 'Tamed' : `#${surge.roll}`} — {surge.effect}
                                   {surge.duration && <i className="fa-solid fa-hourglass-end" title={surge.duration}></i>}
                               </li>
                           ))}
                       </ul>
                   </div>
               )}
              {showAllyModal && (
                  <AllySelectionModal
                      creatures={allyModalCreatures}
                      currentAllies={currentAllies}
                      onConfirm={handleAllyModalConfirm}
                      onCancel={handleAllyModalCancel}
                  />
              )}
  </div>
)
}

export default CharSummary
