
import React from 'react'
import TrackedResourceInput from './TrackedResourceInput.jsx';
import { getClassFeatures } from '../../../services/classFeatures.js';
/* ─── Barbarian ─── */
const BarbarianFeatures = function BarbarianFeatures({ playerStats }) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    const [rageActive, setRageActive] = React.useState(false);
    return (
         <div data-testid="char-class-barbarian">
             <div><b>Extra Attacks: </b>{classLevel?.extra_attacks || 0}</div>
             <TrackedResourceInput label="Rage Points" resourceKey="ragePoints" playerName={playerStats.name} getMax={() => classLevel?.rages || 0} deps={[playerStats]} />
             <div>
                 <b>Rage Damage Bonus: </b>
                 <span className={rageActive ? "stat--buffed" : ""}>{classLevel?.rage_damage || 0}</span>
                 <button className="automation-btn" onClick={() => setRageActive(!rageActive)} title={rageActive ? "End Rage" : "Enter Rage (toggle for damage bonus)"}>
                     <i className={`fas fa-${rageActive ? "fire-alt" : "fire"}`}></i> {rageActive ? "Raging" : "Rage"}
                 </button>
                 {rageActive && <span className="automation-badge">BPS Resist, STR Adv, +{classLevel?.rage_damage || 0} dmg</span>}
             </div>
             <div><b>Weapon Mastery: </b>{classLevel?.weapon_mastery ?? 'N/A'}</div>
         </div>
    );
};

/* ─── Bard ─── */
const BardFeatures = function BardFeatures({ playerStats }) {
    const bardFeatures = getClassFeatures(playerStats);
    return (
         <div data-testid="char-class-bard">
             {playerStats.level > 5 && (bardFeatures?.magicalSecrets ?? false) && <div><b>Extra Attacks: </b>1</div>}
             <div><b>Bardic Inspiration Die: </b>d{bardFeatures?.bardicDie ?? 0}</div>
             <TrackedResourceInput label="Bardic Inspiration Uses" resourceKey="bardicInspirationUses" playerName={playerStats.name} getMax={() => { const charisma = playerStats.abilities?.find((a) => a.name === 'Charisma'); return charisma?.bonus || 0; }} deps={[playerStats]} />
             {bardFeatures?.songOfRestDie && <div><b>Song of Rest Die: </b>d{bardFeatures.songOfRestDie}</div>}
             {bardFeatures?.magicalSecrets !== null && <div><b>Magical Secrets: </b>{bardFeatures.magicalSecrets + bardFeatures.subclassMagicalSecrets}</div>}
             {playerStats.level > 2 && playerStats.class.expertise && <div><b>Expertise: </b>{playerStats.class.expertise.join(', ')}</div>}
         </div>
    );
};

/* ─── Cleric ─── */
const ClericFeatures = function ClericFeatures({ playerStats }) {
    const clericFeatures = getClassFeatures(playerStats);
    return (
         <div data-testid="char-class-cleric">
             <TrackedResourceInput label="Channel Divinity Charges" resourceKey="channelDivinityCharges" playerName={playerStats.name} getMax={() => clericFeatures?.maxChannelDivinity || 0} deps={[playerStats]} />
             {clericFeatures?.destroyUndeadCR !== null && <div><b>Destroy Undead Challenge Rating: </b>{clericFeatures.destroyUndeadCR}</div>}
             <div className="automation-actions">
                 {playerStats.level >= 2 && (
                     <button className="automation-btn" title="Divine Spark: Heal or deal Necrotic/Radiant damage (1d8+WIS)">
                         <i className="fas fa-hands"></i> Divine Spark (1 CD)
                     </button>
                 )}
                 {playerStats.level >= 2 && (
                     <button className="automation-btn" title="Turn Undead: Frighten and Incapacitate Undead within 30 ft (WIS DC)">
                         <i className="fas fa-ghost"></i> Turn Undead (1 CD)
                     </button>
                 )}
                 {playerStats.level >= 7 && (
                     <button className="automation-btn" title="Blessed Strikes: Extra 1d8 Necrotic/Radiant on weapon hit (WIS)">
                         <i className="fas fa-cross"></i> Blessed Strikes
                     </button>
                 )}
             </div>
         </div>
    );
};

/* ─── Druid ─── */
const DruidFeatures = function DruidFeatures({ playerStats }) {
    const druidFeatures = getClassFeatures(playerStats);
    if (playerStats.level < 2) return null;
    return (
         <div data-testid="char-class-druid">
             <TrackedResourceInput label="Wild Shape Uses" resourceKey="wildShapeUses" playerName={playerStats.name} getMax={() => druidFeatures?.maxWildShapeUses || 0} deps={[playerStats]} />
             <div><b>Wild Shape Max Challenge Rating: </b>{druidFeatures?.maxWildShapeChallengeRating}</div>
             {druidFeatures?.beastKnownForms > 0 && <div><b>Beast Forms Known: </b>{druidFeatures.beastKnownForms}</div>}
             <div><b>Wild Shape Limitations: </b>{druidFeatures.wildShapeLimitations}</div>
             <div className="automation-actions">
                 <button className="automation-btn" title="Wild Shape: Transform into a beast form">
                     <i className="fas fa-paw"></i> Wild Shape
                 </button>
             </div>
         </div>
    );
};

/* ─── Fighter ─── */
const FighterFeatures = function FighterFeatures({ playerStats }) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    const majorName = playerStats.class.major?.name || playerStats.class.subclass?.name;
    const hasEnergy = classLevel?.energy && classLevel.energy.required_major === majorName;

    if (!classLevel) return null;

    return (
         <div data-testid="char-class-fighter">
             <div><b>Fighting Styles: </b>{playerStats.class.fightingStyles?.join(', ') || 'N/A'}</div>
             <div><b>Extra Attacks: </b>{classLevel.extra_attacks || 0}</div>
             <div><b>Weapon Mastery: </b>{classLevel.weapon_mastery}</div>
             <TrackedResourceInput label="Second Wind" resourceKey="secondWindUses" playerName={playerStats.name} getMax={() => classLevel?.second_wind || 0} deps={[playerStats]} displayFormat="cur-max" />
             {hasEnergy && (
                 <div>
                     <div><b>Psionic Energy (Psi Warrior):</b></div>
                     <TrackedResourceInput label="Energy Dice" resourceKey="psionicEnergy" playerName={playerStats.name} getMax={() => hasEnergy ? classLevel?.energy?.energy_die_num || 0 : 0} deps={[playerStats]} displayFormat="cur-max" />
                     <div><b>Energy Die Type: </b>d{classLevel.energy.energy_die_type}</div>
                 </div>
             )}
         </div>
    );
};

/* ─── Monk ─── */
const MonkFeatures = function MonkFeatures({ playerStats }) {
    const wisdom = playerStats.abilities?.find((a) => a.name === 'Wisdom');
    const monkFeatures = getClassFeatures(playerStats);
    if (playerStats.level < 2) return null;
    const focusSaveDc = 8 + (wisdom?.bonus || 0) + playerStats.proficiency;
    return (
         <div data-testid="char-class-monk">
             <div><b>Martial Arts Die:</b> d{monkFeatures?.martialArtsDie || 0}</div>
             <div><b>Extra Attacks: </b>{playerStats.class?.class_levels?.[playerStats.level - 1]?.extra_attacks || 0}</div>
             <TrackedResourceInput label="Focus Points" resourceKey="focusPoints" playerName={playerStats.name} getMax={() => monkFeatures?.maxFocusPoints || 0} deps={[playerStats]} />
             <div><b>Focus Save DC: </b>{focusSaveDc}</div>
             <div><b>Unarmored Movement:</b> +{monkFeatures?.unarmoredMovementIncrease || 0} ft.</div>
             <div className="automation-actions">
                 {playerStats.level >= 1 && (
                     <button className="automation-btn" title="Uncanny Metabolism: Regain all FP and heal on initiative">
                         <i className="fas fa-heartbeat"></i> Uncanny Metabolism
                     </button>
                 )}
                 {playerStats.level >= 2 && (
                     <button className="automation-btn" title="Flurry of Blows: 2 Unarmed Strikes as Bonus Action (1 FP)">
                         <i className="fas fa-fist-raised"></i> Flurry of Blows (1 FP)
                     </button>
                 )}
                 {playerStats.level >= 5 && (
                     <button className="automation-btn" title="Stunning Strike: Spend 1 FP, target CON save or stunned">
                         <i className="fas fa-hand-paper"></i> Stunning Strike (1 FP, DC {focusSaveDc})
                     </button>
                 )}
                 {playerStats.reactions?.find(r => r.name === 'Deflect Missiles' || r.name === 'Deflect Attacks') && (
                     <button className="automation-btn" title="Deflect Attacks: Reduce incoming damage by 1d10+DEX+level">
                         <i className="fas fa-shield-alt"></i> {playerStats.reactions.find(r => r.name === 'Deflect Missiles' || r.name === 'Deflect Attacks').name}
                     </button>
                 )}
                 {playerStats.level >= 10 && (
                     <button className="automation-btn" title="Heightened Focus: Flurry gives 3 strikes, Patient Defense grants temp HP">
                         <i className="fas fa-wind"></i> Heightened Focus
                     </button>
                 )}
             </div>
         </div>
    );
};

/* ─── Paladin ─── */
const PaladinFeatures = function PaladinFeatures({ playerStats }) {
    const paladinFeatures = getClassFeatures(playerStats);
    const cha = playerStats.abilities?.find((a) => a.name === 'Charisma');
    const layOnHandsPool = 5 * playerStats.level;
    return (
         <div data-testid="char-class-paladin">
             {playerStats.class.fightingStyles && <div><b>Fighting Styles: </b>{playerStats.class.fightingStyles.join(', ')}</div>}
             <div><b>Extra Attacks: </b>{paladinFeatures?.extraAttacks || 0}</div>
             <div><b>Channel Divinity: </b>{paladinFeatures?.maxChannelDivinity || 0}</div>
             {paladinFeatures?.auraRange !== null && <div><b>Aura Range: </b>{paladinFeatures.auraRange}</div>}
             <div><b>Lay On Hands Pool: </b>{layOnHandsPool} HP</div>
             {cha && <div><b>Aura of Protection: </b>+{cha.bonus} to saves {playerStats.level >= 6 ? '(10 ft.)' : '(locked)'}</div>}
             <div className="automation-actions">
                 <button className="automation-btn" title={`Lay On Hands: Heal up to ${layOnHandsPool} HP from pool`}>
                     <i className="fas fa-hands-helping"></i> Lay On Hands (Pool: {layOnHandsPool})
                 </button>
                 {playerStats.level >= 2 && (
                     <button className="automation-btn" title="Divine Smite: Add radiant damage using a spell slot">
                         <i className="fas fa-bolt"></i> Divine Smite (SPC)
                     </button>
                 )}
             </div>
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
const RogueFeatures = function RogueFeatures({ playerStats }) {
    const rogueFeatures = getClassFeatures(playerStats);
    return (
         <div data-testid="char-class-rogue">
             <div><b>Sneak Attack Damage: </b>+{rogueFeatures?.sneakAttack?.dice_count || 0}d{rogueFeatures?.sneakAttack?.dice_value || 0}</div>
             {rogueFeatures?.expertise && <div><b>Expertise: </b>{rogueFeatures.expertise.join(', ')}</div>}
             <div className="automation-actions">
                 <button className="automation-btn" title="Sneak Attack: Extra damage when you have advantage or ally adjacent">
                     <i className="fas fa-user-ninja"></i> Sneak Attack ({rogueFeatures?.sneakAttack?.dice_count || 0}d{rogueFeatures?.sneakAttack?.dice_value || 0})
                 </button>
                 {playerStats.level >= 9 && (
                     <button className="automation-btn" title="Supreme Sneak: Advantage on Stealth if you move no more than half speed">
                         <i className="fas fa-eye-slash"></i> Supreme Sneak
                     </button>
                 )}
             </div>
         </div>
    );
};

/* ─── Sorcerer ─── */
const SorcererFeatures = function SorcererFeatures({ playerStats }) {
    const sorcererFeatures = getClassFeatures(playerStats);
    return (
         <div data-testid="char-class-sorcerer">
             <TrackedResourceInput label="Sorcery Points" resourceKey="sorceryPoints" playerName={playerStats.name} getMax={() => sorcererFeatures?.maxSorceryPoints || 0} deps={[playerStats]} />
             <div><b>Metamagic Known: </b>{sorcererFeatures?.metamagicKnown}</div>
             {sorcererFeatures?.creatingSpellSlotCosts?.length > 0 && <div><b>Spell Slot (level 1-5) Costs: </b>{sorcererFeatures.creatingSpellSlotCosts.join(', ')}</div>}
             <div className="automation-actions">
                 <button className="automation-btn" title="Metamagic: Apply metamagic options to spells">
                     <i className="fas fa-magic"></i> Metamagic
                 </button>
             </div>
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
             {warlockFeatures?.arcanums && Array.isArray(warlockFeatures.arcanums) && warlockFeatures.arcanums.length > 0 && (
                 <div><b>Eldritch Invocations List: </b>{warlockFeatures.arcanums.join(', ')}</div>
             )}
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
const WizardFeatures = function WizardFeatures({ playerStats }) {
    const wizardFeatures = getClassFeatures(playerStats);
    if ((wizardFeatures?.showWizardFeatures ?? true) === false) return null;
    return (
         <div data-testid="char-class-wizard">
             <TrackedResourceInput label="Arcane Recovery Levels" resourceKey="arcaneRecoveryLevels" playerName={playerStats.name} getMax={() => wizardFeatures?.arcaneRecoveryLevels || 0} deps={[playerStats]} />
             <div className="automation-actions">
                 <button className="automation-btn" title="Arcane Recovery: Regain spell slots on short rest">
                     <i className="fas fa-book-open"></i> Arcane Recovery
                 </button>
             </div>
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
function CharClassFeatures({ playerStats }) {
    const Cmp = CLASS_COMPONENTS[playerStats?.class?.name];
    if (!Cmp) return null;
    return <Cmp playerStats={playerStats} />;
}

export default CharClassFeatures;
