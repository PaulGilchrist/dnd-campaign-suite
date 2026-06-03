
import React from 'react'
import TrackedResourceInput from './TrackedResourceInput.jsx';
import { getClassFeatures } from '../../../services/classFeatures.js';
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

    return (
         <div data-testid="char-class-barbarian">
             <div><b>Extra Attacks: </b>{extraAttacks}</div>
             <TrackedResourceInput label="Rage Points" resourceKey="ragePoints" playerName={playerStats.name} getMax={() => rageCount} deps={[playerStats]} campaignName={campaignName} />
             <div>
                 <b>Rage Damage Bonus: </b>
                 <span className={rageActive ? "stat--buffed" : ""}>{rageDamage}</span>
                 <button className="automation-btn" onClick={() => setRageActive(!rageActive)} title={rageActive ? "End Rage" : "Enter Rage (toggle for damage bonus)"}>
                     <i className={`fas fa-${rageActive ? "fire-alt" : "fire"}`}></i> {rageActive ? "Raging" : "Rage"}
                 </button>
                 {rageActive && <span className="automation-badge">BPS Resist, STR Adv, +{rageDamage} dmg</span>}
             </div>
             <div><b>Weapon Mastery: </b>{weaponMastery}</div>
         </div>
    );
};

/* ─── Bard ─── */
const BardFeatures = function BardFeatures({ playerStats, campaignName }) {
    const bardFeatures = getClassFeatures(playerStats);
    return (
         <div data-testid="char-class-bard">
             {playerStats.level > 5 && (bardFeatures?.magicalSecrets ?? false) && <div><b>Extra Attacks: </b>1</div>}
             <div><b>Bardic Inspiration Die: </b>d{bardFeatures?.bardicDie ?? 0}</div>
             <TrackedResourceInput label="Bardic Inspiration Uses" resourceKey="bardicInspirationUses" playerName={playerStats.name} getMax={() => { const charisma = playerStats.abilities?.find((a) => a.name === 'Charisma'); return charisma?.bonus || 0; }} deps={[playerStats]} campaignName={campaignName} />
             {bardFeatures?.songOfRestDie && <div><b>Song of Rest Die: </b>d{bardFeatures.songOfRestDie}</div>}
             {bardFeatures?.magicalSecrets !== null && <div><b>Magical Secrets: </b>{bardFeatures.magicalSecrets + bardFeatures.subclassMagicalSecrets}</div>}
             {playerStats.level > 2 && playerStats.class.expertise && <div><b>Expertise: </b>{playerStats.class.expertise.join(', ')}</div>}
         </div>
    );
};

/* ─── Cleric ─── */
const ClericFeatures = function ClericFeatures({ playerStats, campaignName }) {
    const clericFeatures = getClassFeatures(playerStats);
    return (
         <div data-testid="char-class-cleric">
             <TrackedResourceInput label="Channel Divinity Charges" resourceKey="channelDivinityCharges" playerName={playerStats.name} getMax={() => clericFeatures?.maxChannelDivinity || 0} deps={[playerStats]} campaignName={campaignName} />
             {clericFeatures?.destroyUndeadCR !== null && <div><b>Destroy Undead Challenge Rating: </b>{clericFeatures.destroyUndeadCR}</div>}

         </div>
    );
};

/* ─── Druid ─── */
const DruidFeatures = function DruidFeatures({ playerStats, campaignName }) {
    const druidFeatures = getClassFeatures(playerStats);
    if (playerStats.level < 2) return null;
    return (
         <div data-testid="char-class-druid">
             <TrackedResourceInput label="Wild Shape Uses" resourceKey="wildShapeUses" playerName={playerStats.name} getMax={() => druidFeatures?.maxWildShapeUses || 0} deps={[playerStats]} campaignName={campaignName} />
             <div><b>Wild Shape Max Challenge Rating: </b>{druidFeatures?.maxWildShapeChallengeRating}</div>
             {druidFeatures?.beastKnownForms > 0 && <div><b>Beast Forms Known: </b>{druidFeatures.beastKnownForms}</div>}
             <div><b>Wild Shape Limitations: </b>{druidFeatures.wildShapeLimitations}</div>

         </div>
    );
};

/* ─── Fighter ─── */
const FighterFeatures = function FighterFeatures({ playerStats, campaignName }) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    const majorName = playerStats.class.major?.name || playerStats.class.subclass?.name;
    const hasEnergy = classLevel?.energy && classLevel.energy.required_major === majorName;

    if (!classLevel) return null;

    return (
         <div data-testid="char-class-fighter">
             <div><b>Fighting Styles: </b>{playerStats.class.fightingStyles?.join(', ') || 'N/A'}</div>
             <div><b>Extra Attacks: </b>{classLevel.extra_attacks || 0}</div>
             <div><b>Weapon Mastery: </b>{classLevel.weapon_mastery}</div>
             <TrackedResourceInput label="Second Wind" resourceKey="secondWindUses" playerName={playerStats.name} getMax={() => classLevel?.second_wind || 0} deps={[playerStats]} displayFormat="cur-max" campaignName={campaignName} />
             {hasEnergy && (
                 <div>
                     <div><b>Psionic Energy (Psi Warrior):</b></div>
                     <TrackedResourceInput label="Energy Dice" resourceKey="psionicEnergy" playerName={playerStats.name} getMax={() => hasEnergy ? classLevel?.energy?.energy_die_num || 0 : 0} deps={[playerStats]} displayFormat="cur-max" campaignName={campaignName} />
                     <div><b>Energy Die Type: </b>d{classLevel.energy.energy_die_type}</div>
                 </div>
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
               <TrackedResourceInput label="Focus Points" resourceKey="focusPoints" playerName={playerStats.name} getMax={() => monkFeatures?.maxFocusPoints || 0} deps={[playerStats]} campaignName={campaignName} />
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
             <div><b>Channel Divinity: </b>{paladinFeatures?.maxChannelDivinity || 0}</div>
             {paladinFeatures?.auraRange !== null && <div><b>Aura Range: </b>{paladinFeatures.auraRange}</div>}
             <TrackedResourceInput label="Lay On Hands Pool" resourceKey="layOnHandsPool" playerName={playerStats.name} getMax={() => layOnHandsPoolMax} deps={[playerStats]} campaignName={campaignName} />
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
const SorcererFeatures = function SorcererFeatures({ playerStats, campaignName }) {
    const sorcererFeatures = getClassFeatures(playerStats);
    return (
         <div data-testid="char-class-sorcerer">
             <TrackedResourceInput label="Sorcery Points" resourceKey="sorceryPoints" playerName={playerStats.name} getMax={() => sorcererFeatures?.maxSorceryPoints || 0} deps={[playerStats]} campaignName={campaignName} />
             <div><b>Metamagic Known: </b>{sorcererFeatures?.metamagicKnown}</div>
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
const WizardFeatures = function WizardFeatures({ playerStats, campaignName }) {
    const wizardFeatures = getClassFeatures(playerStats);
    if ((wizardFeatures?.showWizardFeatures ?? true) === false) return null;
    return (
         <div data-testid="char-class-wizard">
             <TrackedResourceInput label="Arcane Recovery Levels" resourceKey="arcaneRecoveryLevels" playerName={playerStats.name} getMax={() => wizardFeatures?.arcaneRecoveryLevels || 0} deps={[playerStats]} campaignName={campaignName} />
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
function CharClassFeatures({ playerStats, campaignName }) {
    const Cmp = CLASS_COMPONENTS[playerStats?.class?.name];
    if (!Cmp) return null;
    return <Cmp playerStats={playerStats} campaignName={campaignName} />;
}

export default CharClassFeatures;
