
import React from 'react'
import TrackedResourceInput from './tracked-resource-input.jsx';
import { getClassFeatures } from '../../../services/class-features.js';
import { isEqual } from 'lodash';

const areEqual = (prevProps, nextProps) => isEqual(prevProps.playerStats, nextProps.playerStats);

/* ─── Barbarian ─── */
const BarbarianFeatures = React.memo(function BarbarianFeatures({ playerStats }) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    return (
         <div data-testid="char-class-barbarian">
             <div><b>Extra Attacks: </b>{classLevel?.extra_attacks || 0}</div>
             <TrackedResourceInput label="Rage Points" resourceKey="ragePoints" playerName={playerStats.name} getMax={() => classLevel?.rages || 0} deps={[playerStats]} />
             <div><b>Rage Damage Bonus: </b>{classLevel?.rage_damage || 0}</div>
             <div><b>Weapon Mastery: </b>{classLevel?.weapon_mastery ?? 'N/A'}</div>
         </div>
    );
}, areEqual);

/* ─── Bard ─── */
const BardFeatures = React.memo(function BardFeatures({ playerStats }) {
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
}, areEqual);

/* ─── Cleric ─── */
const ClericFeatures = React.memo(function ClericFeatures({ playerStats }) {
    const clericFeatures = getClassFeatures(playerStats);
    return (
         <div data-testid="char-class-cleric">
             <TrackedResourceInput label="Channel Divinity Charges" resourceKey="channelDivinityCharges" playerName={playerStats.name} getMax={() => clericFeatures?.maxChannelDivinity || 0} deps={[playerStats]} />
             {clericFeatures?.destroyUndeadCR !== null && <div><b>Destroy Undead Challenge Rating: </b>{clericFeatures.destroyUndeadCR}</div>}
         </div>
    );
}, areEqual);

/* ─── Druid ─── */
const DruidFeatures = React.memo(function DruidFeatures({ playerStats }) {
    const druidFeatures = getClassFeatures(playerStats);
    if (playerStats.level < 2) return null;
    return (
         <div data-testid="char-class-druid">
             <TrackedResourceInput label="Wild Shape Uses" resourceKey="wildShapeUses" playerName={playerStats.name} getMax={() => druidFeatures?.maxWildShapeUses || 0} deps={[playerStats]} />
             <div><b>Wild Shape Max Challenge Rating: </b>{druidFeatures?.maxWildShapeChallengeRating}</div>
             {druidFeatures?.beastKnownForms > 0 && <div><b>Beast Forms Known: </b>{druidFeatures.beastKnownForms}</div>}
             <div><b>Wild Shape Limitations: </b>{druidFeatures.wildShapeLimitations}</div>
         </div>
    );
}, areEqual);

/* ─── Fighter ─── */
const FighterFeatures = React.memo(function FighterFeatures({ playerStats }) {
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
}, areEqual);

/* ─── Monk ─── */
const MonkFeatures = React.memo(function MonkFeatures({ playerStats }) {
    const wisdom = playerStats.abilities?.find((a) => a.name === 'Wisdom');
    const monkFeatures = getClassFeatures(playerStats);
    if (playerStats.level < 2) return null;
    return (
         <div data-testid="char-class-monk">
             <div><b>Martial Arts Die:</b> d{monkFeatures?.martialArtsDie || 0}</div>
             <div><b>Extra Attacks: </b>{playerStats.class?.class_levels?.[playerStats.level - 1]?.extra_attacks || 0}</div>
             <TrackedResourceInput label="Focus Points" resourceKey="focusPoints" playerName={playerStats.name} getMax={() => monkFeatures?.maxFocusPoints || 0} deps={[playerStats]} />
             <div><b>Focus Save DC: </b>{8 + (wisdom?.bonus || 0) + playerStats.proficiency}</div>
             <div><b>Unarmored Movement:</b> +{monkFeatures?.unarmoredMovementIncrease || 0} ft.</div>
         </div>
    );
}, areEqual);

/* ─── Paladin ─── */
const PaladinFeatures = React.memo(function PaladinFeatures({ playerStats }) {
    const paladinFeatures = getClassFeatures(playerStats);
    return (
         <div data-testid="char-class-paladin">
             {playerStats.class.fightingStyles && <div><b>Fighting Styles: </b>{playerStats.class.fightingStyles.join(', ')}</div>}
             <div><b>Extra Attacks: </b>{paladinFeatures?.extraAttacks || 0}</div>
             <div><b>Channel Divinity: </b>{paladinFeatures?.maxChannelDivinity || 0}</div>
             {paladinFeatures?.auraRange !== null && <div><b>Aura Range: </b>{paladinFeatures.auraRange}</div>}
         </div>
    );
}, areEqual);

/* ─── Ranger ─── */
const RangerFeatures = React.memo(function RangerFeatures({ playerStats }) {
    const rangerFeatures = getClassFeatures(playerStats);
    return (
         <div data-testid="char-class-ranger">
             {playerStats.class.fightingStyles && playerStats.level > 1 && <div><b>Fighting Styles: </b>{playerStats.class.fightingStyles.join(', ')}</div>}
             <div><b>Extra Attacks: </b>{rangerFeatures?.extraAttacks || 0}</div>
             <div><b>Favored Enemies: </b>{rangerFeatures?.favoredEnemies}</div>
         </div>
    );
}, areEqual);

/* ─── Rogue ─── */
const RogueFeatures = React.memo(function RogueFeatures({ playerStats }) {
    const rogueFeatures = getClassFeatures(playerStats);
    return (
         <div data-testid="char-class-rogue">
             <div><b>Sneak Attack Damage: </b>+{rogueFeatures?.sneakAttack?.dice_count || 0}d{rogueFeatures?.sneakAttack?.dice_value || 0}</div>
             {rogueFeatures?.expertise && <div><b>Expertise: </b>{rogueFeatures.expertise.join(', ')}</div>}
         </div>
    );
}, areEqual);

/* ─── Sorcerer ─── */
const SorcererFeatures = React.memo(function SorcererFeatures({ playerStats }) {
    const sorcererFeatures = getClassFeatures(playerStats);
    return (
         <div data-testid="char-class-sorcerer">
             <TrackedResourceInput label="Sorcery Points" resourceKey="sorceryPoints" playerName={playerStats.name} getMax={() => sorcererFeatures?.maxSorceryPoints || 0} deps={[playerStats]} />
             <div><b>Metamagic Known: </b>{sorcererFeatures?.metamagicKnown}</div>
             {sorcererFeatures?.creatingSpellSlotCosts?.length > 0 && <div><b>Spell Slot (level 1-5) Costs: </b>{sorcererFeatures.creatingSpellSlotCosts.join(', ')}</div>}
         </div>
    );
}, areEqual);

/* ─── Warlock ─── */
const WarlockFeatures = React.memo(function WarlockFeatures({ playerStats }) {
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
         </div>
    );
}, areEqual);

/* ─── Wizard ─── */
const WizardFeatures = React.memo(function WizardFeatures({ playerStats }) {
    const wizardFeatures = getClassFeatures(playerStats);
    if ((wizardFeatures?.showWizardFeatures ?? true) === false) return null;
    return (
         <div data-testid="char-class-wizard">
             <TrackedResourceInput label="Arcane Recovery Levels" resourceKey="arcaneRecoveryLevels" playerName={playerStats.name} getMax={() => wizardFeatures?.arcaneRecoveryLevels || 0} deps={[playerStats]} />
         </div>
    );
}, areEqual);

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
