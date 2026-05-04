/* eslint-disable react/prop-types */
import React from 'react'
import storage from '../../../services/storage'
import classRules from '../../../services/class-rules'
import classRules2024 from '../../../services/class-rules-2024'
import HiddenInput from '../../common/hidden-input'
import { isEqual } from 'lodash';

const areEqual = (prevProps, nextProps) => isEqual(prevProps.playerStats, nextProps.playerStats);

/* Shared hook for tracked (editable) class resources.
   Follows the same pattern across all classes: load from storage on mount,
   fall back to a computed max, persist on change.                    */
function useTrackedResource(storageKey, playerName, max) {
    const [value, setValue] = React.useState(0);
    const [showInput, setShowInput] = React.useState(false);
    React.useEffect(() => {
        const stored = storage.getProperty(playerName, storageKey);
        setValue(stored ? stored : max);
      }, [playerName, storageKey, max]);
    const handleToggle = () => setShowInput((s) => !s);
    const handleChange = (v) => {
        storage.setProperty(playerName, storageKey, v);
        setValue(v);
      };
    return { value, showInput, handleToggle, handleChange };
}

/* ─── Barbarian ─── */
const BarbarianFeatures = React.memo(function BarbarianFeatures({ playerStats }) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    const { value: ragePoints, showInput, handleToggle, handleChange } =
        useTrackedResource('ragePoints', playerStats.name, classLevel?.rages || 0);
    return (
          <div data-testid="char-class-barbarian">
              <div><b>Extra Attacks: </b>{classLevel?.extra_attacks || 0}</div>
              <div className="clickable" onClick={handleToggle} onKeyDown={handleToggle} tabIndex={0}>
                  <b>Rage Points:</b> {classLevel?.rages || 0}/<HiddenInput handleInputToggle={handleToggle} handleValueChange={handleChange} showInput={showInput} value={ragePoints}></HiddenInput> <span className="text-muted">(max/cur)</span>
              </div>
              <div><b>Rage Damage Bonus: </b>{classLevel?.rage_damage || 0}</div>
              <div><b>Weapon Mastery: </b>{classLevel?.weapon_mastery ?? 'N/A'}</div>
          </div>
      );
}, areEqual);

/* ─── Bard ─── */
const BardFeatures = React.memo(function BardFeatures({ playerStats }) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    const is2024 = playerStats.rules === '2024';
    const charisma = playerStats.abilities?.find((a) => a.name === 'Charisma');
    let extraAttacks = 0;
    if (playerStats.level > 5) extraAttacks = 1;
    const bardicDie = is2024
          ? classLevel?.bardic_die || 0
          : classLevel?.class_specific?.bardic_inspiration_die || 0;
    const songOfRestDie = is2024 ? null : classLevel?.class_specific?.song_of_rest_die;
    const magicalSecrets = is2024 ? null : classLevel?.class_specific?.magical_secrets_max_5 || 0;
    let subclassMagicalSecrets = 0;
    if (!is2024 && playerStats.class.subclass && playerStats.class.subclass.name === 'Lore' && playerStats.level > 2) {
        subclassMagicalSecrets = classRules.getHighestSubclassLevel(playerStats)?.subclass_specific?.additional_magical_secrets_max_lvl || 0;
      }
    const maxInspiration = charisma?.bonus || 0;
    const { value: bardicInspirationUses, showInput, handleToggle, handleChange } =
        useTrackedResource('bardicInspirationUses', playerStats.name, maxInspiration);
    return (
          <div data-testid="char-class-bard">
              {playerStats.level > 5 && !is2024 && <div><b>Extra Attacks: </b>{extraAttacks}</div>}
              <div>
                  <b>Bardic Inspiration Die: </b>d{bardicDie}
                  <span className="clickable" onClick={handleToggle} onKeyDown={handleToggle} tabIndex={0}>
                      &nbsp;&nbsp;<b>Uses:</b> {maxInspiration}/<HiddenInput handleInputToggle={handleToggle} handleValueChange={handleChange} showInput={showInput} value={bardicInspirationUses}></HiddenInput> <span className="text-muted">(max/cur)</span>
                  </span>
              </div>
              {songOfRestDie && <div><b>Song of Rest Die: </b>d{songOfRestDie}</div>}
              {magicalSecrets !== null && <div><b>Magical Secrets: </b>{magicalSecrets + subclassMagicalSecrets}</div>}
              {playerStats.level > 2 && playerStats.class.expertise && <div><b>Expertise: </b>{playerStats.class.expertise.join(', ')}</div>}
          </div>
      );
}, areEqual);

/* ─── Cleric ─── */
const ClericFeatures = React.memo(function ClericFeatures({ playerStats }) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    const is2024 = playerStats.rules === '2024';
    const maxChannelDivinity = is2024
          ? classLevel?.channel_divinity || 0
          : classLevel?.class_specific?.channel_divinity_charges || 0;
    const destroyUndeadCR = is2024
          ? null
          : classLevel?.class_specific?.destroy_undead_cr;
    const { value: channelDivinityCharges, showInput, handleToggle, handleChange } =
        useTrackedResource('channelDivinityCharges', playerStats.name, maxChannelDivinity);
    return (
          <div data-testid="char-class-cleric">
              <div className="clickable" onClick={handleToggle} onKeyDown={handleToggle} tabIndex={0}>
                  <b>Channel Divinity Charges:</b> {maxChannelDivinity}/<HiddenInput handleInputToggle={handleToggle} handleValueChange={handleChange} showInput={showInput} value={channelDivinityCharges}></HiddenInput> <span className="text-muted">(max/cur)</span>
              </div>
              {destroyUndeadCR !== null && <div><b>Destroy Undead Challenge Rating: </b>{destroyUndeadCR}</div>}
          </div>
      );
}, areEqual);

/* ─── Druid ─── */
const DruidFeatures = React.memo(function DruidFeatures({ playerStats }) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    const is2024 = playerStats.rules === '2024';
    if (playerStats.level < 2) return null;
    let maxWildShapeUses;
    let maxWildShapeChallengeRating;
    let beastKnownForms;
    let wildShapeLimitations;
    if (is2024) {
        maxWildShapeChallengeRating = classRules2024.getDruidMaxWildShapeChallengeRating(playerStats);
        maxWildShapeUses = classRules2024.getDruidWildShapeUses(playerStats);
        beastKnownForms = classRules2024.getDruidBeastKnownForms(playerStats);
        const canFly = classRules2024.getDruidBeastFlySpeed(playerStats);
        wildShapeLimitations = canFly ? 'walk, swim, or fly' : 'walk or swim only (no fly)';
      } else {
        const classSpecific = classLevel?.class_specific;
        maxWildShapeChallengeRating = classRules.getDruidMaxWildShapeChallengeRating(playerStats);
        maxWildShapeUses = 2;
        wildShapeLimitations = classSpecific?.wild_shape_fly
              ? 'walk, swim, or fly'
              : classSpecific?.wild_shape_swim
                  ? 'walk or swim only (no fly)'
                  : 'walk only (no swim or fly)';
      }
    const { value: wildShapeUses, showInput, handleToggle, handleChange } =
        useTrackedResource('wildShapeUses', playerStats.name, maxWildShapeUses || 0);
    return (
          <div data-testid="char-class-druid">
              <div className="clickable" onClick={handleToggle} onKeyDown={handleToggle} tabIndex={0}>
                  <b>Wild Shape Uses:</b> {maxWildShapeUses}/<HiddenInput handleInputToggle={handleToggle} handleValueChange={handleChange} showInput={showInput} value={wildShapeUses}></HiddenInput> <span className="text-muted">(max/cur)</span>
              </div>
              <div><b>Wild Shape Max Challenge Rating: </b>{maxWildShapeChallengeRating}</div>
              {is2024 && <div><b>Beast Forms Known: </b>{beastKnownForms}</div>}
              <div><b>Wild Shape Limitations: </b>{wildShapeLimitations}</div>
          </div>
      );
}, areEqual);

/* ─── Fighter ─── */
const FighterFeatures = React.memo(function FighterFeatures({ playerStats }) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    if (!classLevel) return null;
    const majorName = playerStats.class.major?.name || playerStats.class.subclass?.name;
    const hasEnergy = classLevel.energy && classLevel.energy.required_major === majorName;
    const { value: secondWindUses, showInput: showSecondWindInput, handleToggle: handleSecondWindToggle, handleChange: handleSecondWindChange } =
        useTrackedResource('secondWindUses', playerStats.name, classLevel.second_wind || 0);
    const maxEnergy = hasEnergy ? classLevel.energy?.energy_die_num || 0 : 0;
    const { value: psionicEnergy, showInput: showPsionicEnergyInput, handleToggle: handlePsionicEnergyToggle, handleChange: handlePsionicEnergyChange } =
        useTrackedResource('psionicEnergy', playerStats.name, maxEnergy);
    return (
          <div data-testid="char-class-fighter">
              <div><b>Fighting Styles: </b>{playerStats.class.fightingStyles?.join(', ') || 'N/A'}</div>
              <div><b>Extra Attacks: </b>{classLevel.extra_attacks || 0}</div>
              <div><b>Weapon Mastery: </b>{classLevel.weapon_mastery}</div>
              <div className="clickable" onClick={handleSecondWindToggle} onKeyDown={handleSecondWindToggle} tabIndex={0}>
                  <b>Second Wind:</b> {secondWindUses}/{classLevel.second_wind}<HiddenInput handleInputToggle={handleSecondWindToggle} handleValueChange={handleSecondWindChange} showInput={showSecondWindInput} value={secondWindUses} displayValue={false}></HiddenInput> <span className="text-muted">(cur/max)</span>
              </div>
              {hasEnergy && (
                  <div>
                      <div><b>Psionic Energy (Psi Warrior):</b></div>
                      <div className="clickable" onClick={handlePsionicEnergyToggle} onKeyDown={handlePsionicEnergyToggle} tabIndex={0}>
                          <b>Energy Dice:</b> {psionicEnergy}/{classLevel.energy?.energy_die_num}<HiddenInput handleInputToggle={handlePsionicEnergyToggle} handleValueChange={handlePsionicEnergyChange} showInput={showPsionicEnergyInput} value={psionicEnergy} displayValue={false}></HiddenInput> <span className="text-muted">(cur/max)</span>
                      </div>
                      <div><b>Energy Die Type: </b>d{classLevel.energy.energy_die_type}</div>
                  </div>
              )}
          </div>
      );
}, areEqual);

/* ─── Monk ─── */
const MonkFeatures = React.memo(function MonkFeatures({ playerStats }) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    if (playerStats.level < 2) return null;
    const wisdom = playerStats.abilities?.find((a) => a.name === 'Wisdom');
    const martialArtsDie = classRules2024.getMartialArtsDie(playerStats);
    const unarmoredMovementIncrease = classRules2024.getUnarmoredMovementIncrease(playerStats);
    const maxFocusPoints = classRules2024.getFocusPoints(playerStats);
    const { value: focusPoints, showInput, handleToggle, handleChange } =
        useTrackedResource('focusPoints', playerStats.name, maxFocusPoints || 0);
    return (
          <div data-testid="char-class-monk">
              <div><b>Martial Arts Die:</b> d{martialArtsDie}</div>
              <div><b>Extra Attacks: </b>{classLevel?.extra_attacks || 0}</div>
              <div className="clickable" onClick={handleToggle} onKeyDown={handleToggle} tabIndex={0}>
                  <b>Focus Points:</b> {maxFocusPoints}/<HiddenInput handleInputToggle={handleToggle} handleValueChange={handleChange} showInput={showInput} value={focusPoints}></HiddenInput> <span className="text-muted">(max/cur)</span>
              </div>
              <div><b>Focus Save DC: </b>{8 + (wisdom?.bonus || 0) + playerStats.proficiency}</div>
              <div><b>Unarmored Movement:</b> +{unarmoredMovementIncrease} ft.</div>
          </div>
      );
}, areEqual);

/* ─── Paladin ─── */
const PaladinFeatures = React.memo(function PaladinFeatures({ playerStats }) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    const is2024 = playerStats.rules === '2024';
    const classSpecific = classLevel?.class_specific || {};
    const channelDivinity = is2024
          ? classLevel?.channel_divinity || 0
          : classSpecific.channel_divinity_charges || 0;
    let extraAttacks = 0;
    if (playerStats.level > 4) extraAttacks = 1;
    return (
          <div data-testid="char-class-paladin">
              {playerStats.class.fightingStyles && <div><b>Fighting Styles: </b>{playerStats.class.fightingStyles.join(', ')}</div>}
              <div><b>Extra Attacks: </b>{extraAttacks}</div>
              <div><b>Channel Divinity: </b>{channelDivinity}</div>
              {!is2024 && <div><b>Aura Range: </b>{classSpecific.aura_range}</div>}
          </div>
      );
}, areEqual);

/* ─── Ranger ─── */
const RangerFeatures = React.memo(function RangerFeatures({ playerStats }) {
    let extraAttacks = 0;
    if (playerStats.level > 4) extraAttacks = 1;
    const favoredEnemiesCount = classRules2024.getFavoredEnemy(playerStats);
    return (
          <div data-testid="char-class-ranger">
              {playerStats.class.fightingStyles && playerStats.level > 1 && <div><b>Fighting Styles: </b>{playerStats.class.fightingStyles.join(', ')}</div>}
              <div><b>Extra Attacks: </b>{extraAttacks}</div>
              <div><b>Favored Enemies: </b>{favoredEnemiesCount}</div>
          </div>
      );
}, areEqual);

/* ─── Rogue ─── */
const RogueFeatures = React.memo(function RogueFeatures({ playerStats }) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    if (!classLevel) return null;
    let sneakAttack;
    if (classLevel.sneak_attack_num_d6 !== undefined) {
        sneakAttack = { dice_count: classLevel.sneak_attack_num_d6, dice_value: 6 };
      } else if (classLevel.class_specific && classLevel.class_specific.sneak_attack) {
        sneakAttack = classLevel.class_specific.sneak_attack;
      } else {
        sneakAttack = { dice_count: 0, dice_value: 6 };
      }
    return (
          <div data-testid="char-class-rogue">
              <div><b>Sneak Attack Damage: </b>+{sneakAttack.dice_count}d{sneakAttack.dice_value}</div>
              {playerStats.class.expertise && <div><b>Expertise: </b>{playerStats.class.expertise.join(', ')}</div>}
          </div>
      );
}, areEqual);

/* ─── Sorcerer ─── */
const SorcererFeatures = React.memo(function SorcererFeatures({ playerStats }) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    const is2024 = playerStats.rules === '2024';
    const maxSorceryPoints = is2024
          ? classLevel?.sorcery_points || 0
          : classLevel?.class_specific?.sorcery_points || 0;
    let metamagicKnown = 0;
    if (is2024) {
        if (playerStats.level >= 3) metamagicKnown = 2;
        if (playerStats.level >= 10) metamagicKnown = 4;
        if (playerStats.level >= 17) metamagicKnown = 6;
      } else {
        metamagicKnown = classLevel?.class_specific?.metamagic_known || 0;
      }
    const creatingSpellSlotCosts = [];
    if (!is2024 && classLevel?.class_specific?.creating_spell_slots) {
        classLevel.class_specific.creating_spell_slots.forEach((slot) => {
            creatingSpellSlotCosts.push(slot.sorcery_point_cost);
          });
      }
    const { value: sorceryPoints, showInput, handleToggle, handleChange } =
        useTrackedResource('sorceryPoints', playerStats.name, maxSorceryPoints);
    return (
          <div data-testid="char-class-sorcerer">
              <div className="clickable" onClick={handleToggle} onKeyDown={handleToggle} tabIndex={0}>
                  <b>Sorcery Points:</b> {maxSorceryPoints}/<HiddenInput handleInputToggle={handleToggle} handleValueChange={handleChange} showInput={showInput} value={sorceryPoints}></HiddenInput> <span className="text-muted">(max/cur)</span>
              </div>
              <div><b>Metamagic Known: </b>{metamagicKnown}</div>
              {creatingSpellSlotCosts.length > 0 && <div><b>Spell Slot (level 1-5) Costs: </b>{creatingSpellSlotCosts.join(', ')}</div>}
          </div>
      );
}, areEqual);

/* ─── Warlock ─── */
const WarlockFeatures = React.memo(function WarlockFeatures({ playerStats }) {
    const is2024 = playerStats.rules === '2024';
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    let invocationsKnown = 0;
    if (is2024) {
        invocationsKnown = classRules2024.getEldritchInvocations(playerStats);
      } else {
        invocationsKnown = classLevel?.class_specific?.invocations_known || 0;
      }
    return (
          <div data-testid="char-class-warlock">
              {playerStats.level > 10 && !is2024 && (() => {
                 const cls = playerStats.class?.class_levels?.[playerStats.level - 1];
                 const classSpecific = cls?.class_specific;
                 return (
                      <React.Fragment>
                          <div><b>Arcanums Known (levels 6-9): </b>{classSpecific?.mystic_arcanum_level_6 || 0}, {classSpecific?.mystic_arcanum_level_7 || 0}, {classSpecific?.mystic_arcanum_level_8 || 0}, {classSpecific?.mystic_arcanum_level_9 || 0}</div>
                          {playerStats.class.arcanums && Array.isArray(playerStats.class.arcanums) && (
                              <div><b>Arcanums: </b>{[...playerStats.class.arcanums].sort().join(', ')}</div>
                          )}
                      </React.Fragment>
                  );
              })()}
              <div><b>{is2024 ? 'Eldritch Invocations' : 'Invocations Known'}: </b>{invocationsKnown}</div>
              {playerStats.class.invocations && Array.isArray(playerStats.class.invocations) && (
                  <div><b>Invocations: </b>{[...playerStats.class.invocations].sort().join(', ')}</div>
              )}
              {playerStats.class.pactBoon && <div><b>Pact Boon: </b>{playerStats.class.pactBoon}</div>}
              {playerStats.class.eldritchInvocations && playerStats.class.eldritchInvocations.length > 0 && (
                  <div><b>Eldritch Invocations List: </b>{playerStats.class.eldritchInvocations.join(', ')}</div>
              )}
          </div>
      );
}, areEqual);

/* ─── Wizard ─── */
const WizardFeatures = React.memo(function WizardFeatures({ playerStats }) {
    if (playerStats.rules === '2024') return null;
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    const classSpecific = classLevel?.class_specific || {};
    const { value: arcaneRecoveryLevels, showInput, handleToggle, handleChange } =
        useTrackedResource('arcaneRecoveryLevels', playerStats.name, classSpecific.arcane_recovery_levels || 0);
    return (
          <div data-testid="char-class-wizard">
              <div className="clickable" onClick={handleToggle} onKeyDown={handleToggle} tabIndex={0}>
                  <b>Arcane Recovery Levels:</b> {classSpecific.arcane_recovery_levels || 0}/
                  <HiddenInput handleInputToggle={handleToggle} handleValueChange={handleChange} showInput={showInput} value={arcaneRecoveryLevels}></HiddenInput>&nbsp;
                  <span className="text-muted">(max/cur)</span>
              </div>
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

export default CharClassFeatures
