
import React from 'react'
import TrackedResourceInput from './TrackedResourceInput.jsx';
import { getClassFeatures } from '../../../services/character/classFeatures.js';
import { useRuntimeValue, getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
/* ─── Barbarian ─── */
const BarbarianFeatures = function BarbarianFeatures({ playerStats, campaignName }) {
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
             <div><b>Extra Attacks: </b>{extraAttacks}</div>
             <TrackedResourceInput label="Rage Points" resourceKey="ragePoints" playerName={playerStats.name} getMax={() => rageCount} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
             <div>
                 <b>Rage Damage Bonus: </b>
                 <span className={rageActive ? "stat--buffed" : ""}>{rageDamage}</span>
                 <button className="automation-btn" onClick={() => setRageActive(!rageActive)} title={rageActive ? "End Rage" : "Enter Rage (toggle for damage bonus)"}>
                     <i className={`fas fa-${rageActive ? "fire-alt" : "fire"}`}></i> {rageActive ? "Raging" : "Rage"}
                 </button>
                 {rageActive && <span className="automation-badge">BPS Resist, STR Adv, +{rageDamage} dmg</span>}
             </div>
             <div><b>Weapon Mastery: </b>{weaponMastery}</div>
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
         </div>
    );
};

const BardFeatures = function BardFeatures({ playerStats, campaignName }) {
    const bardFeatures = getClassFeatures(playerStats);
    const multiMinuteBadges = useActiveBuffs(playerStats, campaignName);
    const hasFontOfInspiration = (playerStats.automation?.passives ?? []).some(p => p.type === 'font_of_inspiration');
    const biMax = (() => { const charisma = playerStats.abilities?.find(a => a.name === 'Charisma'); return charisma?.bonus || 0; })();
    const biCurrent = getRuntimeValue(playerStats.name, 'bardicInspirationUses', campaignName);
    const biStored = biCurrent != null ? Number(biCurrent) : biMax;
    const fontOfInspirationAvailable = hasFontOfInspiration && biStored < biMax;

    const handleFontOfInspirationConversion = async () => {
        if (!fontOfInspirationAvailable) return;
        const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        let spellSlotKey = null;
        let slotMax = 0;
        for (const level of levels) {
            const key = `spell_slots_level_${level}`;
            const current = getRuntimeValue(playerStats.name, key, campaignName);
            const max = playerStats.spellAbilities?.[key] ?? 0;
            const stored = current != null ? Number(current) : max;
            if (stored > 0) {
                spellSlotKey = key;
                slotMax = max;
                break;
            }
        }
        if (!spellSlotKey) return;
        const currentSlot = getRuntimeValue(playerStats.name, spellSlotKey, campaignName);
        const slotStored = currentSlot != null ? Number(currentSlot) : slotMax;
        if (slotStored <= 0) return;
        await setRuntimeValue(playerStats.name, spellSlotKey, slotStored - 1, campaignName);
        await setRuntimeValue(playerStats.name, 'bardicInspirationUses', biStored + 1, campaignName);
    };

    return (
           <div data-testid="char-class-bard">
               {multiMinuteBadges.map((b, i) => <span key={i} className="automation-badge">{b.name}</span>)}
               {playerStats.level > 5 && (bardFeatures?.magicalSecrets ?? false) && <div><b>Extra Attacks: </b>1</div>}
               <div><b>Bardic Inspiration Die: </b>d{bardFeatures?.bardicDie ?? 0}</div>
               <TrackedResourceInput label="Bardic Inspiration Uses" resourceKey="bardicInspirationUses" playerName={playerStats.name} getMax={() => { const charisma = playerStats.abilities?.find((a) => a.name === 'Charisma'); return charisma?.bonus || 0; }} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
               {bardFeatures?.songOfRestDie && <div><b>Song of Rest Die: </b>d{bardFeatures.songOfRestDie}</div>}
                {bardFeatures?.magicalSecrets !== null && <TrackedResourceInput label="Magical Secrets" resourceKey="magicalSecrets" playerName={playerStats.name} getMax={() => bardFeatures.magicalSecrets + bardFeatures.subclassMagicalSecrets} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />}
                {playerStats.level > 2 && playerStats.class.expertise && <div><b>Expertise: </b>{playerStats.class.expertise.join(', ')}</div>}
                {hasFontOfInspiration && (
                    <div className="automation-actions">
                        <button
                            className={'automation-btn' + (!fontOfInspirationAvailable ? ' automation-btn--disabled' : '')}
                            onClick={handleFontOfInspirationConversion}
                            disabled={!fontOfInspirationAvailable}
                            title="Font of Inspiration: Expend a spell slot to regain 1 Bardic Inspiration use"
                        >
                            <i className="fas fa-wand-magic-sparkles"></i> Font of Inspiration
                        </button>
                        {!fontOfInspirationAvailable && <span className="automation-badge">Max BI</span>}
                    </div>
                )}
            </div>
        );


};

/* ─── Cleric ─── */
const ClericFeatures = function ClericFeatures({ playerStats, campaignName }) {
    const clericFeatures = getClassFeatures(playerStats);
    return (
         <div data-testid="char-class-cleric">
             <TrackedResourceInput label="Channel Divinity Charges" resourceKey="channelDivinityCharges" playerName={playerStats.name} getMax={() => clericFeatures?.maxChannelDivinity || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
             {clericFeatures?.destroyUndeadCR !== null && <div><b>Destroy Undead Challenge Rating: </b>{clericFeatures.destroyUndeadCR}</div>}

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
               <TrackedResourceInput label="Wild Shape Uses" resourceKey="wildShapeUses" playerName={playerStats.name} getMax={() => druidFeatures?.maxWildShapeUses || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
               {multiMinuteBadges.map((b, i) => <span key={i} className="automation-badge">{b.name}</span>)}
               <div><b>Wild Shape Max Challenge Rating: </b>{druidFeatures?.maxWildShapeChallengeRating}</div>
               {druidFeatures?.beastKnownForms > 0 && <div><b>Beast Forms Known: </b>{druidFeatures.beastKnownForms}</div>}
               <div><b>Wild Shape Limitations: </b>{druidFeatures.wildShapeLimitations}</div>
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

           </div>
        );
};

/* ─── Fighter ─── */
const FighterFeatures = function FighterFeatures({ playerStats, campaignName }) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    const majorName = playerStats.class.major?.name || playerStats.class.subclass?.name;
    const hasEnergy = classLevel?.energy && classLevel.energy.required_major === majorName;
    const isBattleMaster = majorName === 'Battle Master';

    if (!classLevel) return null;

    const actionsurgeMax = playerStats.rules === '2024'
          ? (playerStats.level >= 17 ? 2 : (playerStats.level >= 2 ? 1 : 0))
          : (classLevel?.class_specific?.action_surges || 0);

    const superiorityDiceMax = !isBattleMaster ? 0 : (playerStats.rules === '2024' ? 4 : (playerStats.level >= 15 ? 6 : (playerStats.level >= 7 ? 5 : 4)));

    const superiorityDieType = !isBattleMaster ? 0 : (playerStats.level >= 18 ? 12 : (playerStats.level >= 10 ? 10 : 8));

    return (
          <div data-testid="char-class-fighter">
              <div><b>Fighting Styles: </b>{playerStats.class.fightingStyles?.join(', ') || 'N/A'}</div>
              <div><b>Extra Attacks: </b>{classLevel.extra_attacks || 0}</div>
              <div><b>Weapon Mastery: </b>{classLevel.weapon_mastery}</div>
              <TrackedResourceInput label="Second Wind" resourceKey="secondWindUses" playerName={playerStats.name} getMax={() => classLevel?.second_wind || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
              <TrackedResourceInput label="Action Surge Uses" resourceKey="actionsurgeUses" playerName={playerStats.name} getMax={() => actionsurgeMax} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
              {hasEnergy && (
                  <div>
                      <div><b>Psionic Energy (Psi Warrior):</b></div>
                      <TrackedResourceInput label="Energy Dice" resourceKey="psionicEnergy" playerName={playerStats.name} getMax={() => hasEnergy ? classLevel?.energy?.energy_die_num || 0 : 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
                      <div><b>Energy Die Type: </b>d{classLevel.energy.energy_die_type}</div>
                  </div>
              )}
              {isBattleMaster && (
                  <>
                  <TrackedResourceInput label="Superiority Dice" resourceKey="superiorityDice" playerName={playerStats.name} getMax={() => superiorityDiceMax} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
                  <div><b>Superiority Die: </b>d{superiorityDieType}</div>
                  </>
               )}
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
               <div><b>Martial Arts Die:</b> d{monkFeatures?.martialArtsDie || 0}</div>
               <div><b>Extra Attacks: </b>{playerStats.class?.class_levels?.[playerStats.level - 1]?.extra_attacks || 0}</div>
               <TrackedResourceInput label="Focus Points" resourceKey="focusPoints" playerName={playerStats.name} getMax={() => monkFeatures?.maxFocusPoints || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
               <div><b>Focus Save DC: </b>{focusSaveDc}</div>
               <div><b>Unarmored Movement:</b> +{monkFeatures?.unarmoredMovementIncrease || 0} ft.</div>
           </div>
      );
};

/* ─── Paladin ─── */
const PaladinFeatures = function PaladinFeatures({ playerStats, campaignName }) {
    const paladinFeatures = getClassFeatures(playerStats);
    const cha = playerStats.abilities?.find((a) => a.name === 'Charisma');
    const layOnHandsPoolMax = 5 * playerStats.level;
    return (
         <div data-testid="char-class-paladin">
             {playerStats.class.fightingStyles && <div><b>Fighting Styles: </b>{playerStats.class.fightingStyles.join(', ')}</div>}
             <div><b>Extra Attacks: </b>{paladinFeatures?.extraAttacks || 0}</div>
             <TrackedResourceInput label="Channel Divinity Charges" resourceKey="channelDivinityCharges" playerName={playerStats.name} getMax={() => paladinFeatures?.maxChannelDivinity || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
             {paladinFeatures?.auraRange !== null && <div><b>Aura Range: </b>{paladinFeatures.auraRange}</div>}
             <TrackedResourceInput label="Lay On Hands Pool" resourceKey="layOnHandsPool" playerName={playerStats.name} getMax={() => layOnHandsPoolMax} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
             {cha && <div><b>Aura of Protection: </b>+{cha.bonus} to saves {playerStats.level >= 6 ? '(10 ft.)' : '(locked)'}</div>}

         </div>
    );
};

/* ─── Ranger ─── */
const RangerFeatures = function RangerFeatures({ playerStats }) {
    const rangerFeatures = getClassFeatures(playerStats);
    return (
         <div data-testid="char-class-ranger">
             {playerStats.class.fightingStyles && playerStats.level > 1 && <div><b>Fighting Styles: </b>{playerStats.class.fightingStyles.join(', ')}</div>}
             <div><b>Extra Attacks: </b>{rangerFeatures?.extraAttacks || 0}</div>
             <div><b>Favored Enemies: </b>{rangerFeatures?.favoredEnemies}</div>
             <div className="automation-actions">
                 {playerStats.level >= 2 && (
                     <button className="automation-btn" title="Favored Foe: Mark a foe for extra 1d4 damage">
                         <i className="fas fa-crosshairs"></i> Favored Foe
                     </button>
                 )}
                 {playerStats.level >= 2 && (
                     <button className="automation-btn" title="Cunning Strike: Add poison/extra effects to weapon hits">
                         <i className="fas fa-skull-crossbones"></i> Cunning Strike
                     </button>
                 )}
             </div>
         </div>
    );
};

/* ─── Rogue ─── */
const RogueFeatures = function RogueFeatures({ playerStats, campaignName }) {
    const rogueFeatures = getClassFeatures(playerStats);
    const stealthAttackActive = getRuntimeValue(playerStats.name, 'stealthAttackCost', campaignName) > 0;

    const handleSupremeSneak = async () => {
        if (stealthAttackActive) {
            await setRuntimeValue(playerStats.name, 'stealthAttackCost', 0, campaignName);
            return;
        }
        const sneakAttackDice = rogueFeatures?.sneakAttack?.dice_count || 0;
        if (sneakAttackDice < 1) {
            return;
        }
        await setRuntimeValue(playerStats.name, 'stealthAttackCost', 1, campaignName);
    };

    return (
         <div data-testid="char-class-rogue">
             <div><b>Sneak Attack Damage: </b>+{rogueFeatures?.sneakAttack?.dice_count || 0}d{rogueFeatures?.sneakAttack?.dice_value || 0}</div>
             {rogueFeatures?.expertise && <div><b>Expertise: </b>{rogueFeatures.expertise.join(', ')}</div>}
             <div className="automation-actions">
                 <button className="automation-btn" title="Sneak Attack: Extra damage when you have advantage or ally adjacent">
                     <i className="fas fa-user-ninja"></i> Sneak Attack ({rogueFeatures?.sneakAttack?.dice_count || 0}d{rogueFeatures?.sneakAttack?.dice_value || 0})
                 </button>
                 {playerStats.level >= 9 && (
                     <button
                         className={'automation-btn' + (stealthAttackActive ? ' automation-btn--active' : '')}
                         onClick={handleSupremeSneak}
                         title={stealthAttackActive ? "Supreme Sneak: Stealth Attack active — next attack costs 1d6 Sneak Attack, Invisible preserved with cover" : "Supreme Sneak: Activate Stealth Attack (costs 1d6 Sneak Attack, preserves Invisible with cover)"}
                     >
                         <i className="fas fa-eye-slash"></i> Supreme Sneak
                     </button>
                 )}
             </div>
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
                   <TrackedResourceInput label="Sorcery Points" resourceKey="sorceryPoints" playerName={playerStats.name} getMax={() => sorcererFeatures?.maxSorceryPoints || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
                   <TrackedResourceInput label="Metamagic Known" resourceKey="metamagicKnown" playerName={playerStats.name} getMax={() => sorcererFeatures?.metamagicKnown || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
                   {hasRestoration && <TrackedResourceInput label="Sorcerous Restoration" resourceKey="sorcerousRestorationUses" playerName={playerStats.name} getMax={() => 1} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />}
                    <TrackedResourceInput label="Innate Sorcery" resourceKey="innateSorceryUses" playerName={playerStats.name} getMax={() => sorcererFeatures?.maxInnateSorcery || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
                  {innateSorceryActive && <span className="automation-badge">+1 Save DC, Spell Adv</span>}
                  {revelationOption && <span className="automation-badge">{REVELATION_EFFECTS[revelationOption.effect] || 'Revelation in Flesh'}</span>}
                  {sorcererFeatures?.creatingSpellSlotCosts?.length > 0 && <div><b>Spell Slot (level 1-5) Costs: </b>{sorcererFeatures.creatingSpellSlotCosts.join(', ')}</div>}

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
                     <div><b>Arcanums Known (levels 6-9): </b>{warlockFeatures.arcanumLevels?.level6 || 0}, {warlockFeatures.arcanumLevels?.level7 || 0}, {warlockFeatures.arcanumLevels?.level8 || 0}, {warlockFeatures.arcanumLevels?.level9 || 0}</div>
                     {warlockFeatures.arcanums && Array.isArray(warlockFeatures.arcanums) && (
                         <div><b>Arcanums: </b>{[...warlockFeatures.arcanums].sort().join(', ')}</div>
                     )}
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
    const hasPortent = (playerStats.automation?.specialActions ?? []).some(
        a => a.type === 'portent' || a.name === 'Portent'
    );
    const [portentDice, setPortentDiceState] = React.useState([]);
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

    if ((wizardFeatures?.showWizardFeatures ?? true) === false) return null;
    return (
         <div data-testid="char-class-wizard">
             <TrackedResourceInput label="Arcane Recovery Levels" resourceKey="arcaneRecoveryLevels" playerName={playerStats.name} getMax={() => wizardFeatures?.arcaneRecoveryLevels || 0} deps={[playerStats]} campaignName={campaignName} playerStats={playerStats} />
             <div className="automation-actions">
                 <button className="automation-btn" title="Arcane Recovery: Regain spell slots on short rest">
                     <i className="fas fa-book-open"></i> Arcane Recovery
                 </button>
             </div>
              {hasPortent && (
                  <div>
                      <div><b>Portent Dice:</b></div>
                      <div className="portent-dice-display">
                          {portentDice.length > 0
                              ? portentDice.map((die, i) => (
                                  <span key={i} className="portent-die">{die}</span>
                              ))
                              : <span className="automation-badge">No dice remaining</span>
                          }
                      </div>
                      <span className="automation-badge">{portentDice.length} remaining (refreshes on Long Rest)</span>
                  </div>
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
    if (!Cmp) return null;
    return <Cmp playerStats={playerStats} campaignName={campaignName} />;
}

export default CharClassFeatures;
