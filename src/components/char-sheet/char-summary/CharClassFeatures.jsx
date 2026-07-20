
import React from 'react'
import TrackedResourceInput from './TrackedResourceInput.jsx';
import { getClassFeatures } from '../../../services/character/classFeatures.js';
import { useRuntimeValue, getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { executeHandler } from '../../../services/automation/index.js';
import { hasGloriousDefenseActive } from '../../../services/automation/handlers/class-cleric-paladin/gloriousDefenseHandler.js';
import { applyPortentChoice } from '../../../services/automation/handlers/class-wizard/portentHandler.js';
import Popup from '../../common/popup.jsx';
import WeaponKindMasteryModal from '../modals/WeaponKindMasteryModal.jsx';
import { loadFightingStyles } from '../../../services/ui/dataLoader.js';
import { isUnbreakableMajestyActive, getUnbreakableMajestySaveDc, clearUnbreakableMajesty } from '../../../services/combat/auras/unbreakableMajesty.js';
import { getAuraRangeFromStats } from '../../../services/combat/auras/auraOfProtection.js';
/* ─── Barbarian ─── */
const BarbarianFeatures = function BarbarianFeatures({ playerStats, campaignName, onWeaponMasteryClick }) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    const is2024 = playerStats.rules === '2024';

    const extraAttacks = is2024
        ? (classLevel?.extra_attacks || 0)
        : (playerStats.level > 4 ? 1 : 0);

    const rageCount = is2024
        ? (classLevel?.rages || 0)
        : (classLevel?.class_specific?.rage_count || 0);

    const rageDamage = is2024
        ? (classLevel?.rage_damage || 0)
        : (classLevel?.class_specific?.rage_damage_bonus || 0);

    const weaponMastery = is2024
        ? (classLevel?.weapon_mastery ?? 'N/A')
        : 'N/A';

    const hasAspectOfTheWilds = (playerStats.automation?.specialActions ?? []).some(
        p => p.type === 'animal_aspect'
    );
    const aspectChoice = useRuntimeValue(playerStats.name, 'aspectOfTheWildsOption', campaignName);

    const activeBuffs = useRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
    const rageActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.name === 'Rage');
    const recklessAttackActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'advantage_attacks_advantage_against');
    const wildHeartBuff = Array.isArray(activeBuffs) ? activeBuffs.find(b => b.name === 'Rage of the Wilds') : null;
    const wildHeartOption = wildHeartBuff?.optionName || null;

    const warriorOfTheGodsFeature = (playerStats.bonusActions || []).find(f => f.name === 'Warrior of the Gods');
    const maxDice = playerStats.level >= 17 ? 7 : playerStats.level >= 12 ? 6 : playerStats.level >= 6 ? 5 : 4;

    return (
          <div data-testid="char-class-barbarian">
               <div><b>Extra Attacks: </b>{extraAttacks}</div>
               <TrackedResourceInput label="Rage Points" resourceKey="ragePoints" playerName={playerStats.name} getMax={() => rageCount} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
               <div>
                   <b>Rage Damage Bonus: </b>
                   <span className={rageActive ? "stat--buffed" : ""}>{rageDamage}</span>
                   {rageActive && <span className="automation-badge">BPS Resist, STR Adv, +{rageDamage} dmg</span>}
               </div>
                {recklessAttackActive && <span className="automation-badge">Reckless Attack — attacks against you have Advantage</span>}
                {hasAspectOfTheWilds && aspectChoice && (
                    <div>
                        <span className="automation-badge">Aspect of the Wilds: {aspectChoice}</span>
                    </div>
                )}
                {wildHeartOption && (
                    <div>
                        <span className="automation-badge">Rage of the Wilds: {wildHeartOption}</span>
                    </div>
                )}
               <div><b>Weapon Mastery: </b><span className="clickable" onClick={onWeaponMasteryClick}>{weaponMastery}</span></div>
               {warriorOfTheGodsFeature && (
                   <TrackedResourceInput 
                       label="Warrior of the Gods" 
                       resourceKey="warriorofthegodsPool" 
                       playerName={playerStats.name} 
                       getMax={() => maxDice} 
                       deps={[playerStats]} 
                       campaignName={campaignName} 
                       playerStats={playerStats} 
                   />
               )}
          </div>
    );
};

const BardFeatures = function BardFeatures({ playerStats, campaignName }) {
    const bardFeatures = getClassFeatures(playerStats);
    const multiMinuteBadges = useActiveBuffs(playerStats, campaignName);
    const majestyActive = isUnbreakableMajestyActive(playerStats.name, campaignName);
    const majestyDc = getUnbreakableMajestySaveDc(playerStats.name, campaignName);

    function toggleMajesty() {
        if (majestyActive) {
            clearUnbreakableMajesty(playerStats.name, campaignName);
        } else {
            const chaBonus = playerStats.abilities?.find(a => a.name === 'Charisma')?.bonus || 0;
            const prof = playerStats.proficiency || 0;
            setRuntimeValue(playerStats.name, 'unbreakableMajestyActive', true, campaignName);
            setRuntimeValue(playerStats.name, 'unbreakableMajestySaveDc', 8 + chaBonus + prof, campaignName);
        }
    }

    return (
           <div data-testid="char-class-bard">
                {multiMinuteBadges.map((b, i) => <span key={i} className="automation-badge">{b.name}</span>)}
                {(playerStats.automation?.passives ?? []).some(p => p.type === 'passive_rule' && p.riderSave) && (
                    <TrackedResourceInput label="Beguiling Magic" resourceKey="postCastRider_Beguiling_Magic" playerName={playerStats.name} getMax={() => 1} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
                )}
                <div><b>Bardic Inspiration Die: </b>d{bardFeatures?.bardicDie ?? 0}</div>
                <TrackedResourceInput label="Bardic Inspiration Uses" resourceKey="bardicInspirationUses" playerName={playerStats.name} getMax={() => { const charisma = playerStats.abilities?.find((a) => a.name === 'Charisma'); return charisma?.bonus || 0; }} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
                {playerStats.level > 2 && playerStats.expertise && playerStats.expertise.length > 0 && <div><b>Expertise: </b>{playerStats.expertise.join(', ')}</div>}
                {playerStats.level > 5 && (bardFeatures?.magicalSecrets ?? false) && <div><b>Extra Attacks: </b>1</div>}
                {bardFeatures?.magicalSecrets !== null && <TrackedResourceInput label="Magical Secrets" resourceKey="magicalSecrets" playerName={playerStats.name} getMax={() => bardFeatures.magicalSecrets + bardFeatures.subclassMagicalSecrets} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />}
                {majestyActive && (
                    <button
                        className="automation-btn majesty-badge majesty-badge--active"
                        onClick={() => toggleMajesty()}
                        title={`Unbreakable Majesty (DC ${majestyDc})\n\nFirst attack per turn that hits forces attacker to make a CHA save or the attack misses.\nClick to deactivate.`}
                    >
                        <i className="fa-solid fa-shield-halved"></i> Unbreakable Majesty DC {majestyDc}
                    </button>
                )}
                {bardFeatures?.songOfRestDie && <div><b>Song of Rest Die: </b>d{bardFeatures.songOfRestDie}</div>}
            </div>
         );

    };

/* ─── Cleric ─── */
const ClericFeatures = function ClericFeatures({ playerStats, campaignName }) {
    const clericFeatures = getClassFeatures(playerStats);
    const isLifeDomain = (playerStats.class?.major?.name === 'Life Domain') || (playerStats.class?.subclass?.name === 'Life Domain');
    const preserveLifePoolMax = isLifeDomain ? (5 * playerStats.level) : 0;
    const wisMod = playerStats.abilities?.find(a => a.name === 'Wisdom')?.bonus || 0;
    return (
         <div data-testid="char-class-cleric">
             <TrackedResourceInput label="Channel Divinity Charges" resourceKey="channelDivinityCharges" playerName={playerStats.name} getMax={() => clericFeatures?.maxChannelDivinity || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
             {clericFeatures?.destroyUndeadCR !== null && <div><b>Destroy Undead Challenge Rating: </b>{clericFeatures.destroyUndeadCR}</div>}
             {isLifeDomain && (
                 <TrackedResourceInput label="Preserve Life Pool" resourceKey="preserveLifePool" playerName={playerStats.name} getMax={() => preserveLifePoolMax} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
             )}
             <TrackedResourceInput label="Warding Flare Uses" resourceKey="wardingflareUses" playerName={playerStats.name} getMax={() => Math.max(1, wisMod)} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
         </div>
    );
};

/* ─── Helpers for showing active buffs with multi-minute duration ─── */
 const MULTI_MINUTE_DURATIONS = new Set([
      '1_minute', '10_minutes', 'hour', 'half_druid_level_hours',
      'long_rest', 'while_illusion_active'
  ]);

  function getMultiMinuteBadges(activeBuffs) {
      void activeBuffs;
      return Array.isArray(activeBuffs) ? activeBuffs.filter(b => MULTI_MINUTE_DURATIONS.has(b.duration)) : [];
  }

  function formatDuration(duration, playerStats) {
      if (duration === 'half_druid_level_hours') {
          const druidLevel = playerStats?.class?.class_levels?.find(cl => cl.level === playerStats?.level);
          const wildShape = druidLevel?.wild_shape || 0;
          const hours = Math.floor(wildShape / 2);
          return `${hours} hour${hours !== 1 ? 's' : ''}`;
      }
      return duration;
  }

/* ─── Generic Hook: subscribe to buffs for any class ─── */
 function useActiveBuffs(playerStats, campaignName) {
     const activeBuffs = useRuntimeValue(playerStats?.name, 'activeBuffs', campaignName);
     return getMultiMinuteBadges(activeBuffs);
 }

 /* ─── Druid ─── */
const DruidFeatures = function DruidFeatures({ playerStats, campaignName }) {
    const druidFeatures = getClassFeatures(playerStats);
    const multiMinuteBadges = useActiveBuffs(playerStats, campaignName);
    const hasNaturalRecovery = (playerStats.automation?.passives ?? []).some(
        p => p.type === 'natural_recovery'
    );
    const naturalRecoveryFreeCast = getRuntimeValue(playerStats.name, 'naturalRecoveryFreeCast');
    const naturalRecoveryFreeCastUsed = getRuntimeValue(playerStats.name, 'naturalRecoveryFreeCastUsed');
    const elementalFuryChoice = useRuntimeValue(playerStats.name, '_Elemental_Fury_option', campaignName);
    const improvedElementalFuryChoice = useRuntimeValue(playerStats.name, '_Improved_Elemental_Fury_option', campaignName);
    const circleOfTheLandType = useRuntimeValue(playerStats.name, '_circleOfTheLandType', campaignName);
    const isCircleOfTheMoon = playerStats.class?.major?.name === 'Circle of the Moon' || playerStats.class?.subclass?.name === 'Circle of the Moon';
    const isCircleOfTheStars = playerStats.class?.major?.name === 'Circle of the Stars' || playerStats.class?.subclass?.name === 'Circle of the Stars';
    const wis = playerStats.abilities?.find(a => a.name === 'Wisdom');
    const moonlightStepMax = isCircleOfTheMoon ? Math.max(wis?.bonus || 0, 1) : 0;
    const wrathOfTheSeaActive = useRuntimeValue(playerStats.name, 'wrathOfTheSeaActive', campaignName);
    const cosmicOmenEffect = useRuntimeValue(playerStats.name, 'cosmicOmenEffect', campaignName);
    if (playerStats.level < 2) return null;
    return (
           <div data-testid="char-class-druid">
                {multiMinuteBadges.map((b, i) => <span key={i} className="automation-badge">{b.name}: {formatDuration(b.duration, playerStats)}</span>)}
                {druidFeatures?.beastKnownForms > 0 && <div><b>Beast Forms Known: </b>{druidFeatures.beastKnownForms}</div>}
                {isCircleOfTheStars && playerStats.level >= 6 && (
                    <>
                        {cosmicOmenEffect && (() => {
                            try {
                                const effect = JSON.parse(cosmicOmenEffect);
                                if (effect.type) {
                                    return <span className="automation-badge"><i className="fa-solid fa-star"></i> Cosmic Omen: {effect.type} ({effect.isEven ? 'Even' : 'Odd'})</span>;
                                }
                            } catch (_e) { /* ignore */ }
                            return null;
                        })()}
                        <TrackedResourceInput label="Cosmic Omen Uses" resourceKey="cosmicomenUses" playerName={playerStats.name} getMax={() => Math.max(wis?.bonus || 0, 1)} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
                        <TrackedResourceInput label="Star Map Free Casts" resourceKey="_Star_Map_freeCastCount" playerName={playerStats.name} getMax={() => Math.max(wis?.bonus || 0, 1)} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
                    </>
                )}
                {circleOfTheLandType && <span className="automation-badge"><i className="fa-solid fa-mountain-sun"></i> Circle of the Land: {circleOfTheLandType}</span>}
                {elementalFuryChoice && <span className="automation-badge"><i className="fa-solid fa-bolt"></i> Elemental Fury: {elementalFuryChoice}</span>}
                {improvedElementalFuryChoice && <span className="automation-badge"><i className="fa-solid fa-bolt"></i> Improved Elemental Fury: {improvedElementalFuryChoice}</span>}
                {isCircleOfTheMoon && <TrackedResourceInput label="Moonlight Step Uses" resourceKey="moonlightStepUses" playerName={playerStats.name} getMax={() => moonlightStepMax} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />}
                {hasNaturalRecovery && (
                    <div>
                        <div><b>Natural Recovery:</b></div>
                        {Array.isArray(naturalRecoveryFreeCast) && naturalRecoveryFreeCast.length > 0 && (
                            <div className="automation-badge"><i className="fa-solid fa-check"></i> Free cast: {naturalRecoveryFreeCast[0]}</div>
                        )}
                        {naturalRecoveryFreeCastUsed && (
                            <div className="automation-badge"><i className="fa-solid fa-check"></i> Free cast used</div>
                        )}
                    </div>
                )}
                <div><b>Wild Shape Limitations: </b>{druidFeatures.wildShapeLimitations}</div>
                <div><b>Wild Shape Max Challenge Rating: </b>{druidFeatures?.maxWildShapeChallengeRating}</div>
                <TrackedResourceInput label="Wild Shape Uses" resourceKey="wildShapeUses" playerName={playerStats.name} getMax={() => druidFeatures?.maxWildShapeUses || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
                {wrathOfTheSeaActive && (
                    <span className="automation-badge"><i className="fa-solid fa-water"></i> Wrath of the Sea Active</span>
                )}
            </div>
        );
};

/* ─── Fighter ─── */
const FighterFeatures = function FighterFeatures({ playerStats, campaignName, onWeaponMasteryClick }) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    const majorName = playerStats.class.major?.name || playerStats.class.subclass?.name;
    const hasEnergy = classLevel?.energy && classLevel.energy.required_major === majorName;
    const isBattleMaster = majorName === 'Battle Master';
    const [fightingStylePopup, setFightingStylePopup] = React.useState(null);
    const [fightingStylesMap, setFightingStylesMap] = React.useState(null);

    React.useEffect(() => {
        let cancelled = false;
        loadFightingStyles().then(styles => {
            if (cancelled) return;
            const map = {};
            styles.forEach(s => { map[s.name] = s; });
            setFightingStylesMap(map);
        });
        return () => { cancelled = true; };
    }, []);

    const handleFightingStyleClick = (styleName) => {
        const style = fightingStylesMap?.[styleName];
        if (style) {
            setFightingStylePopup(`<b>${style.name}</b><br/>${style.description}<br/><span class="dice-roll-hint">click to dismiss</span>`);
        }
    };

    if (!classLevel) return null;

    const actionsurgeMax = playerStats.rules === '2024'
          ? (playerStats.level >= 17 ? 2 : (playerStats.level >= 2 ? 1 : 0))
          : (classLevel?.class_specific?.action_surges || 0);

    const hasSuperiorityDice = isBattleMaster || playerStats.class.fightingStyles?.includes('Superior Technique');
    const superiorityDiceMax = !hasSuperiorityDice ? 0 : (playerStats._trackedResources?.superiorityDice?.max || 0);

    const superiorityDieType = !hasSuperiorityDice ? 0 : (isBattleMaster ? (playerStats.level >= 18 ? 12 : (playerStats.level >= 10 ? 10 : 8)) : 6);

    return (
          <div data-testid="char-class-fighter">
              <TrackedResourceInput label="Action Surge Uses" resourceKey="actionSurgeUses" playerName={playerStats.name} getMax={() => actionsurgeMax} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
              {hasEnergy && (
                  <div>
                      <TrackedResourceInput label="Energy Dice" resourceKey="psionicEnergy" playerName={playerStats.name} getMax={() => hasEnergy ? classLevel?.energy?.energy_die_num || 0 : 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
                      <div><b>Energy Die Type: </b>d{classLevel.energy.energy_die_type}</div>
                  </div>
              )}
               <div><b>Extra Attacks: </b>{classLevel.extra_attacks || 0}</div>
               <div><b>Fighting Styles: </b>{playerStats.class.fightingStyles ? (
                   <span>{playerStats.class.fightingStyles.map((style, idx) => (
                       <React.Fragment key={style}>
                           {idx > 0 && ', '}
                           <span className="clickable" onClick={() => handleFightingStyleClick(style)}>
                               {style}
                           </span>
                       </React.Fragment>
                   ))}</span>
               ) : 'N/A'}</div>
               {fightingStylePopup && <Popup html={fightingStylePopup} onClickOrKeyDown={() => setFightingStylePopup(null)} />}
               <TrackedResourceInput label="Second Wind" resourceKey="secondWindUses" playerName={playerStats.name} getMax={() => classLevel?.second_wind || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
               {hasSuperiorityDice && (
                   <>
                   <TrackedResourceInput label="Superiority Dice" resourceKey="superiorityDice" playerName={playerStats.name} getMax={() => superiorityDiceMax} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
                   <div><b>Superiority Die: </b>d{superiorityDieType}</div>
                   </>
                )}
            <div><b>Weapon Mastery: </b><span className="clickable" onClick={onWeaponMasteryClick}>{classLevel.weapon_mastery}</span></div>
        </div>
      );
};

/* ─── Monk ─── */
const MonkFeatures = function MonkFeatures({ playerStats, campaignName }) {
    const wisdom = playerStats.abilities?.find((a) => a.name === 'Wisdom');
    const monkFeatures = getClassFeatures(playerStats);
    const activeBuffs = useRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
    const cloakOfShadowsActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'cloak_of_shadows');
    const elementalAttunementActive = useRuntimeValue(playerStats.name, 'elementalAttunementActive', campaignName);
    const elementalAttunementElement = useRuntimeValue(playerStats.name, 'elementalAttunementElement', campaignName);
    const elementalEpitomeActive = useRuntimeValue(playerStats.name, 'elementalEpitomeActive', campaignName);
    const epitomeResistanceType = useRuntimeValue(playerStats.name, 'epitomeResistanceType', campaignName);
    const strideBuff = Array.isArray(activeBuffs) ? activeBuffs.find(b => b.name === 'Stride of the Elements') : null;
    const destructiveStrideActive = useRuntimeValue(playerStats.name, 'destructiveStrideActive', campaignName);
    const STRIDE_LABELS = {
        'ice_walk': 'Ice Walk',
        'speed_boost': '+10 Speed',
        'fly_speed_equals_walk_speed': 'Fly Speed',
        'teleport_ready': 'Teleport 30 ft',
    };
    if (playerStats.level < 2) return null;
    const focusSaveDc = 8 + (wisdom?.bonus || 0) + playerStats.proficiency;
    return (
           <div data-testid="char-class-monk">
               <div><b>Extra Attacks: </b>{playerStats.class?.class_levels?.[playerStats.level - 1]?.extra_attacks || 0}</div>
               <TrackedResourceInput label="Focus Points" resourceKey="focusPoints" playerName={playerStats.name} getMax={() => monkFeatures?.maxFocusPoints || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
               <div><b>Focus Save DC: </b>{focusSaveDc}</div>
               <div><b>Martial Arts Die:</b> d{monkFeatures?.martialArtsDie || 0}</div>
               <div><b>Unarmored Movement:</b> +{monkFeatures?.unarmoredMovementIncrease || 0} ft.</div>
                {cloakOfShadowsActive && <span className="automation-badge">Cloak of Shadows</span>}
                <div className="automation-spacer"></div>
                {elementalAttunementActive && <span className="automation-badge automation-badge--active"><i className="fa-solid fa-wand-magic-sparkles"></i> Elemental Attunement: {elementalAttunementElement}</span>}
                <div className="automation-spacer"></div>
                {strideBuff && <span className="automation-badge automation-badge--active"><i className="fa-solid fa-person-walking"></i> Stride: {STRIDE_LABELS[strideBuff.effect] || 'Stride'}</span>}
                <div className="automation-spacer"></div>
                {elementalEpitomeActive && <span className="automation-badge automation-badge--active"><i className="fa-solid fa-shield-halved"></i> Elemental Epitome: Resistance to {epitomeResistanceType || 'not chosen'}</span>}
                <div className="automation-spacer"></div>
                {destructiveStrideActive && <span className="automation-badge automation-badge--active"><i className="fa-solid fa-person-running"></i> Destructive Stride: +20 Speed</span>}
           </div>
      );
};

/* ─── Paladin ─── */
const PaladinFeatures = function PaladinFeatures({ playerStats, campaignName }) {
    const paladinFeatures = getClassFeatures(playerStats);
    const cha = playerStats.abilities?.find((a) => a.name === 'Charisma');
    const layOnHandsPoolMax = 5 * playerStats.level;
    const [fightingStylePopup, setFightingStylePopup] = React.useState(null);
    const [fightingStylesMap, setFightingStylesMap] = React.useState(null);

    React.useEffect(() => {
        let cancelled = false;
        loadFightingStyles().then(styles => {
            if (cancelled) return;
            const map = {};
            styles.forEach(s => { map[s.name] = s; });
            setFightingStylesMap(map);
        });
        return () => { cancelled = true; };
    }, []);

    const handleFightingStyleClick = (styleName) => {
        const style = fightingStylesMap?.[styleName];
        if (style) {
            setFightingStylePopup(`<b>${style.name}</b><br/>${style.description}<br/><span class="dice-roll-hint">click to dismiss</span>`);
        }
    };
    const holyNimbusActive = useRuntimeValue(playerStats.name, 'holyNimbusActive', campaignName);
    const livingLegendActive = useRuntimeValue(playerStats.name, 'livingLegendActive', campaignName);
    const peerlessAthleteActive = useRuntimeValue(playerStats.name, 'peerlessAthleteActive', campaignName);
    const elderChampionActive = useRuntimeValue(playerStats.name, 'elderChampionActive', campaignName);
    const avengingAngelActive = useRuntimeValue(playerStats.name, 'avengingAngelActive', campaignName);
    return (
         <div data-testid="char-class-paladin">
             {cha && <div><b>Aura of Protection: </b>+{cha.bonus} to saves {playerStats.level >= 6 ? `(${getAuraRangeFromStats(playerStats)} ft.)` : '(locked)'}</div>}
             {paladinFeatures?.auraRange !== null && <div><b>Aura Range: </b>{paladinFeatures.auraRange}</div>}
             <TrackedResourceInput label="Channel Divinity Charges" resourceKey="channelDivinityCharges" playerName={playerStats.name} getMax={() => paladinFeatures?.maxChannelDivinity || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
             <div><b>Extra Attacks: </b>{paladinFeatures?.extraAttacks || 0}</div>
              {playerStats.class.fightingStyles && <div><b>Fighting Styles: </b>{(
                  <span>{playerStats.class.fightingStyles.map((style, idx) => (
                      <React.Fragment key={style}>
                          {idx > 0 && ', '}
                          <span className="clickable" onClick={() => handleFightingStyleClick(style)}>
                              {style}
                          </span>
                      </React.Fragment>
                  ))}</span>
              )}</div>}
              {fightingStylePopup && <Popup html={fightingStylePopup} onClickOrKeyDown={() => setFightingStylePopup(null)} />}
              <TrackedResourceInput label="Lay On Hands Pool" resourceKey="layOnHandsPool" playerName={playerStats.name} getMax={() => layOnHandsPoolMax} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
              {hasGloriousDefenseActive(playerStats) && <TrackedResourceInput label="Glorious Defense Uses" resourceKey="gloriousDefenseUses" playerName={playerStats.name} getMax={() => Math.max(cha?.bonus || 0, 1)} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />}
              {holyNimbusActive && <span className="automation-badge">Holy Nimbus</span>}
             {livingLegendActive && <span className="automation-badge">Living Legend</span>}
              {peerlessAthleteActive === true && <span className="automation-badge automation-badge--active"><i className="fa-solid fa-person-running"></i> Peerless Athlete</span>}
               {elderChampionActive && <span className="automation-badge">Elder Champion</span>}
               {avengingAngelActive && <span className="automation-badge">Avenging Angel</span>}
          </div>
    );
};

/* ─── Ranger ─── */
const RangerFeatures = function RangerFeatures({ playerStats, campaignName }) {
    const rangerFeatures = getClassFeatures(playerStats);
    const [fightingStylePopup, setFightingStylePopup] = React.useState(null);
    const [fightingStylesMap, setFightingStylesMap] = React.useState(null);

    const defensiveTacticsChoice = useRuntimeValue(playerStats.name, '_Defensive_Tactics_choice', campaignName);
    const huntersPreyChoice = useRuntimeValue(playerStats.name, "_Hunter's_Prey_choice", campaignName);

    React.useEffect(() => {
        let cancelled = false;
        loadFightingStyles().then(styles => {
            if (cancelled) return;
            const map = {};
            styles.forEach(s => { map[s.name] = s; });
            setFightingStylesMap(map);
        });
        return () => { cancelled = true; };
    }, []);

    const handleFightingStyleClick = (styleName) => {
        const style = fightingStylesMap?.[styleName];
        if (style) {
            setFightingStylePopup(`<b>${style.name}</b><br/>${style.description}<br/><span class="dice-roll-hint">click to dismiss</span>`);
        }
    };
    return (
          <div data-testid="char-class-ranger">
              {playerStats.level >= 3 && (
                  <TrackedResourceInput label="Dread Ambush" resourceKey="dreadambushUses" playerName={playerStats.name} getMax={() => Math.max(1, (playerStats.abilities?.find(a => a.name === 'Wisdom')?.bonus || 0))} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
              )}
              {playerStats.level >= 2 && (
                  <TrackedResourceInput label="Favored Enemy" resourceKey="favoredEnemyUses" playerName={playerStats.name} getMax={() => Math.max(1, (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level)?.favored_enemy || 0)} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
              )}
              {playerStats.level > 2 && playerStats.expertise && playerStats.expertise.length > 0 && <div><b>Expertise: </b>{playerStats.expertise.join(', ')}</div>}
              {playerStats.class.fightingStyles && playerStats.level > 1 && <div><b>Fighting Styles: </b>{(
                  <span>{playerStats.class.fightingStyles.map((style, idx) => (
                      <React.Fragment key={style}>
                          {idx > 0 && ', '}
                          <span className="clickable" onClick={() => handleFightingStyleClick(style)}>
                              {style}
                          </span>
                      </React.Fragment>
                  ))}</span>
              )}</div>}
              {fightingStylePopup && <Popup html={fightingStylePopup} onClickOrKeyDown={() => setFightingStylePopup(null)} />}
              <div><b>Extra Attacks: </b>{rangerFeatures?.extraAttacks || 0}</div>
              {defensiveTacticsChoice && <span className="automation-badge"><i className="fa-solid fa-shield"></i> {defensiveTacticsChoice}</span>}
              {playerStats.level >= 14 && (
                  <TrackedResourceInput label="Nature's Veil" resourceKey="naturesVeilUses" playerName={playerStats.name} getMax={() => Math.max((playerStats.abilities?.find(a => a.name === 'Wisdom')?.bonus || 0), 1)} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
              )}
              {huntersPreyChoice && <span className="automation-badge"><i className="fa-solid fa-crosshairs"></i> {huntersPreyChoice}</span>}
              {playerStats.level >= 10 && (
                  <TrackedResourceInput label="Tireless" resourceKey="tirelessUses" playerName={playerStats.name} getMax={() => Math.max((playerStats.abilities?.find(a => a.name === 'Wisdom')?.bonus || 0), 1)} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
              )}
          </div>
    );
};

/* ─── Rogue ─── */
const RogueFeatures = function RogueFeatures({ playerStats, campaignName }) {
    const rogueFeatures = getClassFeatures(playerStats);
    const stealthAttackCost = useRuntimeValue(playerStats.name, 'stealthAttackCost', campaignName);
    const stealthAttackActive = (stealthAttackCost ?? 0) > 0;
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    const majorName = playerStats.class.major?.name || playerStats.class.subclass?.name;
    const hasEnergy = classLevel?.energy && classLevel.energy.required_major === majorName;
    return (
          <div data-testid="char-class-rogue">
              {rogueFeatures?.expertise && <div><b>Expertise: </b>{rogueFeatures.expertise.join(', ')}</div>}
              {hasEnergy && (
                  <div>
                      <TrackedResourceInput label="Energy Dice" resourceKey="psionicEnergy" playerName={playerStats.name} getMax={() => classLevel?.energy?.energy_die_num || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
                      <div><b>Energy Die Type: </b>d{classLevel.energy.energy_die_type}</div>
                  </div>
              )}
               {playerStats.level >= 9 && (
                   <span className={'automation-badge' + (stealthAttackActive ? ' automation-badge--active' : '')} title={stealthAttackActive ? "Supreme Sneak: Stealth Attack active — next attack costs 1d6 Sneak Attack, Invisible preserved with cover" : "Supreme Sneak: Available at Rogue level 9 — activate from Actions section"}>
                       <i className="fas fa-eye-slash"></i> Supreme Sneak
                   </span>
               )}
              <div><b>Sneak Attack Damage: </b>+{rogueFeatures?.sneakAttack?.dice_count || 0}d{rogueFeatures?.sneakAttack?.dice_value || 0}</div>
          </div>
    );
};

/* ─── Sorcerer ─── */
const SorcererFeatures = function SorcererFeatures({ playerStats, campaignName }) {
    const sorcererFeatures = getClassFeatures(playerStats);
    const activeBuffs = useRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
    const innateSorceryActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.name === 'Innate Sorcery');
    const telepathicSpeechActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.name === 'Telepathic Speech');
    const hasRestoration = (playerStats.automation?.passives ?? []).some(a => a.type === 'resource_restoration');
    const tranceActive = useRuntimeValue(playerStats.name, 'tranceOfOrderActive', campaignName) === true;
    const REVELATION_EFFECTS = {
        'aquatic_adaptation': 'Aquatic Adaptation',
        'glistening_flight': 'Glistening Flight',
        'see_the_invisible': 'See the Invisible',
        'wormhole_movement': 'Wormhole Movement',
    };
    const revelationBuffs = Array.isArray(activeBuffs) ? activeBuffs.filter(b => b.name === 'Revelation in Flesh') : [];
    return (
            <div data-testid="char-class-sorcerer">
                  {sorcererFeatures?.creatingSpellSlotCosts?.length > 0 && <div><b>Spell Slot (level 1-5) Costs: </b>{sorcererFeatures.creatingSpellSlotCosts.join(', ')}</div>}
                   <TrackedResourceInput label="Innate Sorcery" resourceKey="innateSorceryUses" playerName={playerStats.name} getMax={() => sorcererFeatures?.maxInnateSorcery || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
                   {innateSorceryActive && <span className="automation-badge">+1 Save DC, Spell Adv</span>}
                   {telepathicSpeechActive && <span className="automation-badge"><i className="fa-solid fa-brain"></i> Telepathic Speech</span>}
                    <TrackedResourceInput label="Metamagic Known" resourceKey="metamagicKnown" playerName={playerStats.name} getMax={() => sorcererFeatures?.metamagicKnown || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
                  {revelationBuffs.length > 0 && <span className="automation-badge">{revelationBuffs.map(b => REVELATION_EFFECTS[b.effect] || 'Revelation in Flesh').join(', ')}</span>}
                   {hasRestoration && <TrackedResourceInput label="Sorcerous Restoration" resourceKey="sorcerousRestorationUses" playerName={playerStats.name} getMax={() => 1} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />}
                   <TrackedResourceInput label="Sorcery Points" resourceKey="sorceryPoints" playerName={playerStats.name} getMax={() => sorcererFeatures?.maxSorceryPoints || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
                   {tranceActive && <span className="automation-badge">Trance of Order</span>}
             </div>
        );
};

/* ─── Warlock ─── */
const WarlockFeatures = function WarlockFeatures({ playerStats, campaignName }) {
    const warlockFeatures = getClassFeatures(playerStats);
    const arcanumLevels = warlockFeatures.arcanumLevels || {};
    const hasStepsOfTheFey = (playerStats.automation?.bonusActions ?? []).some(a => a.type === 'steps_of_the_fey');
    const chaMod = playerStats.abilities?.find(a => a.name === 'Charisma')?.bonus || 0;

    return (
         <div data-testid="char-class-warlock">
              {warlockFeatures?.hasArcanum && (
                  <React.Fragment>
                      {[6, 7, 8, 9].map(level => {
                          const hasArcanum = arcanumLevels[`level${level}`] > 0;
                          if (!hasArcanum) return null;
                          return (
                              <TrackedResourceInput
                                  key={level}
                                  label={`${level}th Level Arcanum`}
                                  resourceKey={`mysticArcanumLevel${level}`}
                                  playerName={playerStats.name}
                                  getMax={() => 1}
                                  deps={[playerStats]}
                                  campaignName={campaignName}
                                  playerStats={playerStats}
                              />
                          );
                      })}
                  </React.Fragment>
              )}
              {hasStepsOfTheFey && (
                  <TrackedResourceInput label="Steps of the Fey" resourceKey="_Steps_of_the_Fey_freeCastCount" playerName={playerStats.name} getMax={() => Math.max(chaMod, 1)} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
              )}
             <div><b>{(warlockFeatures?.invocationsKnown ?? 0) > 0 ? 'Eldritch Invocations' : 'Invocations Known'}: </b>{warlockFeatures.invocationsKnown}</div>
             {warlockFeatures?.invocations && Array.isArray(warlockFeatures.invocations) && (
                 <div><b>Invocations: </b>{[...warlockFeatures.invocations].sort().join(', ')}</div>
             )}
             {warlockFeatures?.pactBoon && <div><b>Pact Boon: </b>{warlockFeatures.pactBoon}</div>}
             <div className="automation-actions">
                 {warlockFeatures?.pactBoon && (
                     <button className="automation-btn" title={`Pact Boon: ${warlockFeatures.pactBoon}`}>
                         <i className="fas fa-hand-sparkles"></i> {warlockFeatures.pactBoon}
                     </button>
                 )}
             </div>
         </div>
    );
};

/* ─── Wizard ─── */
const WizardFeatures = function WizardFeatures({ playerStats, campaignName }) {
    const wizardFeatures = getClassFeatures(playerStats);
    const portentAction = (playerStats.specialActions ?? []).find(
        a => a.automation?.type === 'portent'
    );
    const hasPortent = !!portentAction;
    const hasProjectedWard = (playerStats.automation?.reactions ?? []).some(
        a => a.type === 'projected_ward' || a.name === 'Projected Ward'
    );
    const projectedWardReaction = (playerStats.automation?.reactions ?? []).find(
        a => a.type === 'projected_ward' || a.name === 'Projected Ward'
    );
    const projectedWardRange = projectedWardReaction?.range || 30;
    const [portentDice, setPortentDiceState] = React.useState([]);
    const [portentPopup, setPortentPopup] = React.useState(null);
    const [portentModal, setPortentModal] = React.useState(null);
    const activeBuffs = useRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
    const thirdEyeBuff = Array.isArray(activeBuffs) ? (activeBuffs.find(b => b.name === 'The Third Eye') || null) : null;
    const THIRD_EYE_EFFECTS = {
        'darkvision_120': 'Darkvision 120 ft.',
        'greater_comprehension': 'Greater Comprehension',
        'see_invisibility': 'See Invisibility',
    };

    React.useEffect(() => {
        try {
            const stored = getRuntimeValue(playerStats.name, 'portentDice', campaignName);
            if (stored) {
                const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
                if (Array.isArray(parsed)) setPortentDiceState(parsed);
            }
        } catch { /* ignore */ }
    }, [playerStats.name, campaignName]);

    const refreshDiceDisplay = React.useCallback(() => {
        const stored = getRuntimeValue(playerStats.name, 'portentDice', campaignName);
        if (stored) {
            const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
            if (Array.isArray(parsed)) setPortentDiceState(parsed);
        }
    }, [playerStats.name, campaignName]);

    const handlePortentClick = React.useCallback(async () => {
        if (!portentAction) return;
        const result = await executeHandler(portentAction, playerStats, campaignName, null);
        if (!result) return;
        if (result.type === 'modal') {
            setPortentModal(result.payload);
        } else if (result.type === 'popup') {
            const payload = result.payload;
            const html = typeof payload === 'string'
                ? payload
                : `<b>${payload.name || 'Portent'}</b><br/>${payload.description || ''}`;
            setPortentPopup(html);
            refreshDiceDisplay();
        }
    }, [portentAction, playerStats, campaignName, refreshDiceDisplay]);

    const handlePortentDieChoice = React.useCallback(async (chosenDie) => {
        const { action, playerStats: ps, campaignName: cn, targetName, eventType, eventData, context } = portentModal;
        try {
            const result = await applyPortentChoice(action, ps, cn, targetName, eventType, eventData, context, chosenDie);
            setPortentModal(null);
            if (result?.type === 'popup') {
                const payload = result.payload;
                const html = typeof payload === 'string'
                    ? payload
                    : `<b>${payload.name || 'Portent'}</b><br/>${payload.description || ''}`;
                setPortentPopup(html);
                refreshDiceDisplay();
            }
        } catch (e) {
            console.error('[Portent] Failed to apply die choice:', e);
            setPortentModal(null);
        }
    }, [portentModal, refreshDiceDisplay]);

    function getEventDisplayLabel(eventType, eventData) {
        if (eventType === 'attack') {
            return `Attack vs AC ${eventData.targetName || 'unknown'}`;
        }
        if (eventType === 'ability') {
            return eventData.checkName || 'Ability check';
        }
        return eventData.saveType ? eventData.saveType.toUpperCase() : 'Save';
    }

    if ((wizardFeatures?.showWizardFeatures ?? true) === false) return null;
    return (
         <div data-testid="char-class-wizard">
              <TrackedResourceInput label="Arcane Recovery Levels" resourceKey="arcaneRecoveryLevels" playerName={playerStats.name} getMax={() => wizardFeatures?.arcaneRecoveryLevels || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
             <TrackedResourceInput label="Arcane Ward HP" resourceKey="arcaneWardHp" playerName={playerStats.name} getMax={() => playerStats._trackedResources?.arcaneWardMax?.current || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
             {portentPopup && <Popup html={portentPopup} onClickOrKeyDown={() => setPortentPopup(null)} />}
             {portentModal && (
                 <div className="portent-modal-overlay" onClick={() => setPortentModal(null)}>
                     <div className="portent-modal" onClick={e => e.stopPropagation()}>
                         <h3>Portent</h3>
                         <div className="portent-modal-section">
                             <div className="portent-modal-label">Creature: <span className="portent-modal-target">{portentModal.targetName}</span></div>
                             <div className="portent-modal-label">{getEventDisplayLabel(portentModal.eventType, portentModal.eventData)}</div>
                             <div className="portent-modal-original">
                                 d20({portentModal.eventData.d20}) + {portentModal.eventData.bonus} = {portentModal.eventData.d20 + portentModal.eventData.bonus}
                                 {portentModal.eventType === 'attack' && ` (${portentModal.eventData.hit ? 'Hit' : 'Miss'})`}
                             </div>
                         </div>
                         <div className="portent-modal-section">
                             <div className="portent-modal-label">Choose a foretelling roll:</div>
                             <div className="portent-dice-options">
                                 {portentModal.diceOptions.map(die => (
                                     <button key={die} className="portent-die-btn" onClick={() => handlePortentDieChoice(die)}>
                                         {die}
                                     </button>
                                 ))}
                             </div>
                         </div>
                         <div className="portent-modal-actions">
                             <button className="portent-cancel-btn" onClick={() => setPortentModal(null)}>Cancel</button>
                         </div>
                     </div>
                 </div>
             )}
             {hasPortent && (
                  <div>
                      <b>Portent Dice:</b>
                      <span className="portent-dice-display">
                          {portentDice.length > 0
                              ? portentDice.map((die, i) => (
                                  <span key={i} className="portent-die">{die}{i < portentDice.length - 1 ? ', ' : ''}</span>
                              ))
                              : <span className="automation-badge">No dice remaining</span>
                          }
                      </span>
                      <div className="automation-actions">
                          <button className="automation-btn" onClick={handlePortentClick} title="Use Portent to replace a d20 test with a foretelling roll">
                              <i className="fas fa-dice-d20"></i> Use Portent
                          </button>
                      </div>
                      <span className="automation-badge">{portentDice.length} remaining (refreshes on Long Rest)</span>
                  </div>
              )}
              {hasProjectedWard && (
                 <div className="automation-badge">Projected Ward: Allies within {projectedWardRange} ft. (Reaction)</div>
              )}
              {thirdEyeBuff && (
                  <span className="automation-badge">The Third Eye: {THIRD_EYE_EFFECTS[thirdEyeBuff.effect] || 'Active'}</span>
              )}
          </div>
    );
};

/* ─── Registry (maps class name → component) ─── */
const CLASS_COMPONENTS = {
    Barbarian: BarbarianFeatures,
    Bard: BardFeatures,
    Cleric: ClericFeatures,
    Druid: DruidFeatures,
    Fighter: FighterFeatures,
    Monk: MonkFeatures,
    Paladin: PaladinFeatures,
    Ranger: RangerFeatures,
    Rogue: RogueFeatures,
    Sorcerer: SorcererFeatures,
    Warlock: WarlockFeatures,
    Wizard: WizardFeatures,
};

/* ─── Entry point ─── */
function CharClassFeatures({ playerStats, campaignName }) {
    const Cmp = CLASS_COMPONENTS[playerStats?.class?.name];
    const hasAdrenalineRush = (playerStats?.automation?.specialActions ?? []).some(a => a.effect === 'bonus_action_dash');
    const hasStonecunning = (playerStats?.race?.traits || []).some(t => t.name === 'Stonecunning' && t.automation);
    const [modalState, setModalState] = React.useState({});
    const activeBuffs = useRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
    const dodgeActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'dodge');

    const handleWeaponMasteryClick = () => {
        const existing = getRuntimeValue(playerStats.name, '_Weapon_Kind_Mastery_chosenWeapons', campaignName);
        setModalState({ weaponKindMasteryModal: {
            action: { automation: { maxKinds: 'class_level_scaling', meleeOnly: false } },
            meleeOnly: false,
            existing: (existing && Array.isArray(existing)) ? existing : [],
        }});
    };

    if (!Cmp && !hasAdrenalineRush) return null;

    return (
        <>
            {dodgeActive && <span className="automation-badge">Dodge — Disadv on attacks vs you, Adv on DEX saves</span>}
            {hasAdrenalineRush && (
                <TrackedResourceInput label="Adrenaline Rush" resourceKey="adrenalineRushUses" playerName={playerStats.name} getMax={() => playerStats.proficiency || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
            )}
            {hasStonecunning && (
                <TrackedResourceInput label="Stonecunning" resourceKey="stonecunningUses" playerName={playerStats.name} getMax={() => playerStats.proficiency || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
            )}
            {Cmp && <Cmp playerStats={playerStats} campaignName={campaignName} onWeaponMasteryClick={handleWeaponMasteryClick} />}
            {modalState.weaponKindMasteryModal && (
                <WeaponKindMasteryModal
                    {...modalState.weaponKindMasteryModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setModalState({ weaponKindMasteryModal: null })}
                />
            )}
        </>
    );
}

export default CharClassFeatures;
