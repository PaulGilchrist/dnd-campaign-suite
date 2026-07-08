
import React from 'react'
import TrackedResourceInput from './TrackedResourceInput.jsx';
import { getClassFeatures } from '../../../services/character/classFeatures.js';
import { useRuntimeValue, getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { executeHandler } from '../../../services/automation/index.js';
import { applyPortentChoice } from '../../../services/automation/handlers/class-wizard/portentHandler.js';
import Popup from '../../common/popup.jsx';
import WeaponKindMasteryModal from '../modals/WeaponKindMasteryModal.jsx';
import { loadFightingStyles } from '../../../services/ui/dataLoader.js';
import { isUnbreakableMajestyActive, getUnbreakableMajestySaveDc, clearUnbreakableMajesty } from '../../../services/combat/auras/unbreakableMajesty.js';
import { useSyncedState } from '../../../hooks/runtime/useSyncedState.js';
/* ─── Barbarian ─── */
const BarbarianFeatures = function BarbarianFeatures({ playerStats, campaignName, onWeaponMasteryClick }) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    const is2024 = playerStats.rules === '2024';
    const [rageActive, setRageActive] = React.useState(false);

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

    const aspectChoice = useRuntimeValue(playerStats.name, 'aspectOfTheWildsOption', campaignName);
    const hasAspectOfTheWilds = (playerStats.automation?.passives ?? []).some(
        p => p.effect === 'animal_aspect'
    );
    const ASPECT_OPTIONS = ['Owl', 'Panther', 'Salmon'];

    const handleAspectChoice = (option) => {
        setRuntimeValue(playerStats.name, 'aspectOfTheWildsOption', option, campaignName);
    };

    return (
         <div data-testid="char-class-barbarian">
             {hasAspectOfTheWilds && (
                 <div>
                     <b>Aspect of the Wilds: </b>
                     {ASPECT_OPTIONS.map(opt => (
                         <button
                             key={opt}
                             className={'automation-btn' + (aspectChoice === opt ? ' automation-btn--active' : '')}
                             onClick={() => handleAspectChoice(opt)}
                             title={`Select ${opt}`}
                         >
                             <i className={`fas fa-${opt === 'Owl' ? 'eye' : opt === 'Panther' ? 'paw' : 'fish'}`}></i> {opt}{aspectChoice === opt ? ' ✓' : ''}
                         </button>
                     ))}
                     {aspectChoice && <span className="automation-badge">{aspectChoice} active</span>}
                 </div>
             )}
             <div><b>Extra Attacks: </b>{extraAttacks}</div>
             <div>
                 <b>Rage Damage Bonus: </b>
                 <span className={rageActive ? "stat--buffed" : ""}>{rageDamage}</span>
                 <button className="automation-btn" onClick={() => setRageActive(!rageActive)} title={rageActive ? "End Rage" : "Enter Rage (toggle for damage bonus)"}>
                     <i className={`fas fa-${rageActive ? "fire-alt" : "fire"}`}></i> {rageActive ? "Raging" : "Rage"}
                 </button>
                 {rageActive && <span className="automation-badge">BPS Resist, STR Adv, +{rageDamage} dmg</span>}
             </div>
             <TrackedResourceInput label="Rage Points" resourceKey="ragePoints" playerName={playerStats.name} getMax={() => rageCount} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
            <div><b>Weapon Mastery: </b><span className="clickable" onClick={onWeaponMasteryClick}>{weaponMastery}</span></div>
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
                {majestyActive && (
                    <button
                        className="automation-btn majesty-badge majesty-badge--active"
                        onClick={() => toggleMajesty()}
                        title={`Unbreakable Majesty (DC ${majestyDc})\n\nFirst attack per turn that hits forces attacker to make a CHA save or the attack misses.\nClick to deactivate.`}
                    >
                        <i className="fa-solid fa-shield-halved"></i> Unbreakable Majesty DC {majestyDc}
                    </button>
                )}
                <div><b>Bardic Inspiration Die: </b>d{bardFeatures?.bardicDie ?? 0}</div>
                <TrackedResourceInput label="Bardic Inspiration Uses" resourceKey="bardicInspirationUses" playerName={playerStats.name} getMax={() => { const charisma = playerStats.abilities?.find((a) => a.name === 'Charisma'); return charisma?.bonus || 0; }} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
                {(playerStats.automation?.passives ?? []).some(p => p.type === 'passive_rule' && p.riderSave) && (
                    <TrackedResourceInput label="Beguiling Magic" resourceKey="postCastRider_Beguiling_Magic" playerName={playerStats.name} getMax={() => 1} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
                )}
                 {playerStats.level > 2 && playerStats.expertise && playerStats.expertise.length > 0 && <div><b>Expertise: </b>{playerStats.expertise.join(', ')}</div>}
                {playerStats.level > 5 && (bardFeatures?.magicalSecrets ?? false) && <div><b>Extra Attacks: </b>1</div>}
                {bardFeatures?.magicalSecrets !== null && <TrackedResourceInput label="Magical Secrets" resourceKey="magicalSecrets" playerName={playerStats.name} getMax={() => bardFeatures.magicalSecrets + bardFeatures.subclassMagicalSecrets} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />}
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
        p => p.type === 'resource_restoration' && p.resourceKey === 'naturalRecoverySlots'
    );
    const naturalRecoveryFreeCast = getRuntimeValue(playerStats.name, 'naturalRecoveryFreeCast');
    if (playerStats.level < 2) return null;
    return (
           <div data-testid="char-class-druid">
               {multiMinuteBadges.map((b, i) => <span key={i} className="automation-badge">{b.name}</span>)}
               {druidFeatures?.beastKnownForms > 0 && <div><b>Beast Forms Known: </b>{druidFeatures.beastKnownForms}</div>}
               {hasNaturalRecovery && (
                   <div>
                       <div><b>Natural Recovery:</b></div>
                       {naturalRecoveryFreeCast ? (
                           <div className="automation-badge"><i className="fa-solid fa-check"></i> Free cast used</div>
                       ) : (
                           <button className="char-btn char-btn-sm" onClick={() => {
                               const circleSpells = (playerStats.spellAbilities?.spells || []).filter(s => s.level >= 1);
                               if (circleSpells.length > 0) {
                                   setRuntimeValue(playerStats.name, 'naturalRecoveryFreeCast', circleSpells.map(s => s.name), campaignName);
                               }
                           }}>Grant Free Cast (1/Long Rest)</button>
                       )}
                   </div>
               )}
               <div><b>Wild Shape Limitations: </b>{druidFeatures.wildShapeLimitations}</div>
               <div><b>Wild Shape Max Challenge Rating: </b>{druidFeatures?.maxWildShapeChallengeRating}</div>
               <TrackedResourceInput label="Wild Shape Uses" resourceKey="wildShapeUses" playerName={playerStats.name} getMax={() => druidFeatures?.maxWildShapeUses || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
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
    if (playerStats.level < 2) return null;
    const focusSaveDc = 8 + (wisdom?.bonus || 0) + playerStats.proficiency;
    return (
           <div data-testid="char-class-monk">
               <div><b>Extra Attacks: </b>{playerStats.class?.class_levels?.[playerStats.level - 1]?.extra_attacks || 0}</div>
               <TrackedResourceInput label="Focus Points" resourceKey="focusPoints" playerName={playerStats.name} getMax={() => monkFeatures?.maxFocusPoints || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
               <div><b>Focus Save DC: </b>{focusSaveDc}</div>
               <div><b>Martial Arts Die:</b> d{monkFeatures?.martialArtsDie || 0}</div>
               <div><b>Unarmored Movement:</b> +{monkFeatures?.unarmoredMovementIncrease || 0} ft.</div>
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
    return (
         <div data-testid="char-class-paladin">
             {cha && <div><b>Aura of Protection: </b>+{cha.bonus} to saves {playerStats.level >= 6 ? '(10 ft.)' : '(locked)'}</div>}
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
         </div>
    );
};

/* ─── Ranger ─── */
const RangerFeatures = function RangerFeatures({ playerStats }) {
    const rangerFeatures = getClassFeatures(playerStats);
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
    return (
         <div data-testid="char-class-ranger">
              <div className="automation-actions">
                  {playerStats.level >= 2 && (
                      <button className="automation-btn" title="Favored Foe: Mark a foe for extra 1d4 damage">
                          <i className="fas fa-crosshairs"></i> Favored Foe
                      </button>
                  )}
              </div>
             <div><b>Extra Attacks: </b>{rangerFeatures?.extraAttacks || 0}</div>
             <div><b>Favored Enemies: </b>{rangerFeatures?.favoredEnemies}</div>
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
              <div className="automation-actions">
                  <button className="automation-btn" title="Sneak Attack: Extra damage when you have advantage or ally adjacent">
                      <i className="fas fa-user-ninja"></i> Sneak Attack ({rogueFeatures?.sneakAttack?.dice_count || 0}d{rogueFeatures?.sneakAttack?.dice_value || 0})
                  </button>
                  {playerStats.level >= 9 && (
                      <span className={'automation-badge' + (stealthAttackActive ? ' automation-badge--active' : '')} title={stealthAttackActive ? "Supreme Sneak: Stealth Attack active — next attack costs 1d6 Sneak Attack, Invisible preserved with cover" : "Supreme Sneak: Available at Rogue level 9 — activate from Actions section"}>
                          <i className="fas fa-eye-slash"></i> Supreme Sneak
                      </span>
                  )}
              </div>
              <div><b>Sneak Attack Damage: </b>+{rogueFeatures?.sneakAttack?.dice_count || 0}d{rogueFeatures?.sneakAttack?.dice_value || 0}</div>
          </div>
    );
};

/* ─── Sorcerer ─── */
const SorcererFeatures = function SorcererFeatures({ playerStats, campaignName }) {
    const sorcererFeatures = getClassFeatures(playerStats);
    const activeBuffs = useRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
    const innateSorceryActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.name === 'Innate Sorcery');
    const hasRestoration = (playerStats.automation?.passives ?? []).some(a => a.type === 'resource_restoration');
    const revelationOption = Array.isArray(activeBuffs) ? (activeBuffs.find(b => b.name === 'Revelation in Flesh') || null) : null;
    const REVELATION_EFFECTS = {
        'aquatic_adaptation': 'Aquatic Adaptation',
        'glistening_flight': 'Glistening Flight',
        'see_the_invisible': 'See the Invisible',
        'wormhole_movement': 'Wormhole Movement',
    };
    return (
            <div data-testid="char-class-sorcerer">
                  {sorcererFeatures?.creatingSpellSlotCosts?.length > 0 && <div><b>Spell Slot (level 1-5) Costs: </b>{sorcererFeatures.creatingSpellSlotCosts.join(', ')}</div>}
                   <TrackedResourceInput label="Innate Sorcery" resourceKey="innateSorceryUses" playerName={playerStats.name} getMax={() => sorcererFeatures?.maxInnateSorcery || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
                  {innateSorceryActive && <span className="automation-badge">+1 Save DC, Spell Adv</span>}
                   <TrackedResourceInput label="Metamagic Known" resourceKey="metamagicKnown" playerName={playerStats.name} getMax={() => sorcererFeatures?.metamagicKnown || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
                  {revelationOption && <span className="automation-badge">{REVELATION_EFFECTS[revelationOption.effect] || 'Revelation in Flesh'}</span>}
                  {hasRestoration && <TrackedResourceInput label="Sorcerous Restoration" resourceKey="sorcerousRestorationUses" playerName={playerStats.name} getMax={() => 1} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />}
                  <TrackedResourceInput label="Sorcery Points" resourceKey="sorceryPoints" playerName={playerStats.name} getMax={() => sorcererFeatures?.maxSorceryPoints || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
            </div>
        );
};

/* ─── Warlock ─── */
const WarlockFeatures = function WarlockFeatures({ playerStats }) {
    const warlockFeatures = getClassFeatures(playerStats);
    return (
         <div data-testid="char-class-warlock">
             {warlockFeatures?.hasArcanum && (
                 <React.Fragment>
                     {warlockFeatures.arcanums && Array.isArray(warlockFeatures.arcanums) && (
                         <div><b>Arcanums: </b>{[...warlockFeatures.arcanums].sort().join(', ')}</div>
                     )}
                     <div><b>Arcanums Known (levels 6-9): </b>{warlockFeatures.arcanumLevels?.level6 || 0}, {warlockFeatures.arcanumLevels?.level7 || 0}, {warlockFeatures.arcanumLevels?.level8 || 0}, {warlockFeatures.arcanumLevels?.level9 || 0}</div>
                 </React.Fragment>
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
             <div className="automation-actions">
                 <button className="automation-btn" title="Arcane Recovery: Regain spell slots on short rest">
                     <i className="fas fa-book-open"></i> Arcane Recovery
                 </button>
             </div>
             <TrackedResourceInput label="Arcane Recovery Levels" resourceKey="arcaneRecoveryLevels" playerName={playerStats.name} getMax={() => wizardFeatures?.arcaneRecoveryLevels || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
             <TrackedResourceInput label="Arcane Ward HP" resourceKey="arcaneWardHp" playerName={playerStats.name} getMax={() => playerStats._trackedResources?.arcaneWardMax?.current || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
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
    const [modalState, setModalState] = useSyncedState(campaignName, 'modalState', {}, campaignName);

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
            {hasAdrenalineRush && (
                <TrackedResourceInput label="Adrenaline Rush" resourceKey="adrenalineRushUses" playerName={playerStats.name} getMax={() => playerStats.proficiency || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
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
