import React from 'react';
import SecondaryTargetModal from '../modals/shared/SecondaryTargetModal.jsx';
import SingleResistanceSelectionModal from '../modals/SingleResistanceSelectionModal.jsx';
import HexAbilityModal from '../modals/HexAbilityModal.jsx';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import utils from '../../../services/ui/utils.js';

function conditionMatches(c, targetCondition) {
    return (typeof c === 'string' ? c.toLowerCase() : '').trim() === (typeof targetCondition === 'string' ? targetCondition.toLowerCase() : '').trim();
}

async function collectTargetConditions(campaignName, targetName) {
    const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
    let csConditions = [];
    try {
        const cs = await getCombatSummary(campaignName);
        if (cs) {
            const creature = cs.creatures?.find(c => utils.getName(c.name) === utils.getName(targetName));
            if (creature && Array.isArray(creature.conditions)) {
                csConditions = creature.conditions.map(c => c.key);
            }
        }
    } catch { /* ignore */ }
    return [...new Set([...conditions, ...csConditions])];
}

const RESTORATION_CONDITIONS = ['charmed', 'petrified'];
const ALLOWED_CONDITIONS = ['blinded', 'deafened', 'paralyzed', 'poisoned'];

async function getEffectsForTarget(campaignName, targetName) {
    const result = [];
    const allConditions = await collectTargetConditions(campaignName, targetName);
    RESTORATION_CONDITIONS
        .filter(c => allConditions.some(cond => conditionMatches(cond, c)))
        .forEach(c => {
            result.push({ value: `condition:${c}`, label: `${c.charAt(0).toUpperCase() + c.slice(1)} condition` });
        });
    const exhaustion = getRuntimeValue(targetName, 'exhaustionLevel') || 0;
    if (exhaustion > 0) {
        result.push({ value: 'exhaustion', label: `Exhaustion level (current: ${exhaustion})` });
    }
    const activeBuffs = getRuntimeValue(targetName, 'activeBuffs') || [];
    const hasCurse = activeBuffs.some(b => b.type === 'cursed' || b.cursed);
    if (hasCurse) {
        result.push({ value: 'curse', label: 'Curse (including attunement to cursed magic item)' });
    }
    const abilityReductions = getRuntimeValue(targetName, 'abilityReductions') || {};
    if (Object.keys(abilityReductions).length > 0) {
        result.push({ value: 'ability_reduction', label: 'Ability score reduction' });
    }
    const hpMaxReduction = getRuntimeValue(targetName, 'hpMaxReduction') || 0;
    if (hpMaxReduction > 0) {
        result.push({ value: 'hp_max_reduction', label: 'Hit Point maximum reduction' });
    }
    return result;
}

async function getConditionsForTarget(campaignName, targetName) {
    const allConditions = await collectTargetConditions(campaignName, targetName);
    return ALLOWED_CONDITIONS
        .filter(c => allConditions.some(cond => conditionMatches(cond, c)))
        .map(c => ({ value: `condition:${c}`, label: `${c.charAt(0).toUpperCase() + c.slice(1)} condition` }));
}

function GreaterRestorationTargetPicker({ pendingGreaterRestorationTarget, handleGreaterRestorationConfirm, handleGreaterRestorationNoEffects, setPendingGreaterRestorationTarget }) {
    const hasEffects = pendingGreaterRestorationTarget.effects.length > 0;
    const handleEffectSelected = (effectValue) => {
        const type = effectValue.split(':')[0];
        const detail = effectValue.split(':')[1] || null;
        const selection = { type };
        if (detail) {
            selection[type === 'condition' ? 'condition' : type] = detail;
        }
        handleGreaterRestorationConfirm({ targetName: pendingGreaterRestorationTarget.targetName, selections: [selection] });
        setPendingGreaterRestorationTarget(null);
    };
    const handleEffectSkip = () => {
        setPendingGreaterRestorationTarget(null);
    };
    const handleNoEffectsDismiss = () => {
        handleGreaterRestorationNoEffects();
        setPendingGreaterRestorationTarget(null);
    };
    return (
        <SecondaryTargetModal
            title="Greater Restoration"
            targets={pendingGreaterRestorationTarget.effects.map(e => ({ value: e.value, label: e.label }))}
            onTargetSelected={handleEffectSelected}
            onSkip={hasEffects ? handleEffectSkip : handleNoEffectsDismiss}
            description={hasEffects
                ? `Choose one effect to remove from ${pendingGreaterRestorationTarget.targetName}.`
                : `No removable effects found on ${pendingGreaterRestorationTarget.targetName}.`}
            confirmLabel="Remove Effect"
            confirmIcon="fa-hand-holding-medical"
            hideConfirm={!hasEffects}
        />
    );
}

function LesserRestorationTargetPicker({ pendingLesserRestorationTarget, handleLesserRestorationConfirm, handleLesserRestorationSkip, setPendingLesserRestorationTarget }) {
    const hasConditions = pendingLesserRestorationTarget.conditions.length > 0;
    const handleConditionSelected = (conditionValue) => {
        const condition = conditionValue.split(':')[1];
        handleLesserRestorationConfirm({ targetName: pendingLesserRestorationTarget.targetName, condition });
        setPendingLesserRestorationTarget(null);
    };
    const handleConditionSkip = () => {
        setPendingLesserRestorationTarget(null);
    };
    const handleNoConditionsDismiss = () => {
        handleLesserRestorationSkip();
        setPendingLesserRestorationTarget(null);
    };
    return (
        <SecondaryTargetModal
            title="Lesser Restoration"
            targets={pendingLesserRestorationTarget.conditions.map(c => ({ value: c.value, label: c.label }))}
            onTargetSelected={handleConditionSelected}
            onSkip={hasConditions ? handleConditionSkip : handleNoConditionsDismiss}
            description={hasConditions
                ? `Choose one condition to remove from ${pendingLesserRestorationTarget.targetName}.`
                : `No removable conditions found on ${pendingLesserRestorationTarget.targetName}.`}
            confirmLabel="Remove Condition"
            confirmIcon="fa-hand-holding-medical"
            hideConfirm={!hasConditions}
        />
    );
}

const TARGET_SPELL_POPUP_RENDERERS = [
    (p) => p.pendingAuraOfVitality && (
        <SecondaryTargetModal
            title="Aura of Vitality"
            targets={p.pendingAuraOfVitality.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={(targetName) => p.handleAuraOfVitalityConfirm([targetName])}
            onSkip={p.handleAuraOfVitalitySkip}
            description="Choose a creature within 30 feet of you to heal for 2d6 HP. While concentrating on this spell, you can free cast it again once per turn to heal another creature."
            confirmLabel="Cast Aura of Vitality"
            confirmIcon="fa-heart-pulse"
        />
    ),
    (p) => p.pendingForesight && (
        <SecondaryTargetModal
            title="Foresight"
            targets={p.pendingForesight.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={(targetName) => p.handleForesightConfirm([targetName])}
            onSkip={p.handleForesightSkip}
            description="You touch a willing creature and bestow a limited ability to see into the immediate future. For the duration, the target has Advantage on D20 Tests, and other creatures have Disadvantage on attack rolls against it."
            confirmLabel="Cast Foresight"
            confirmIcon="fa-eye"
        />
    ),
    (p) => p.pendingProtectionFromEvilAndGood && (
        <SecondaryTargetModal
            title="Protection from Evil and Good"
            targets={p.pendingProtectionFromEvilAndGood.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={(targetName) => p.handleProtectionFromEvilAndGoodConfirm([targetName])}
            onSkip={p.handleProtectionFromEvilAndGoodSkip}
            description="Choose a willing creature within range (including yourself). Until the spell ends, the target is protected against Aberrations, Celestials, Elementals, Fey, Fiends, and Undead: those creatures have Disadvantage on attack rolls against the target, and the target can't gain the Charmed or Frightened conditions from them."
            confirmLabel="Cast Protection from Evil and Good"
            confirmIcon="fa-shield-halved"
        />
    ),
    (p) => p.pendingProtectionFromPoison && (
        <SecondaryTargetModal
            title="Protection from Poison"
            targets={p.pendingProtectionFromPoison.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={(targetName) => p.handleProtectionFromPoisonConfirm([targetName])}
            onSkip={p.handleProtectionFromPoisonSkip}
            description="Choose a willing creature within range (including yourself). The target gains resistance to Poison damage and Advantage on saving throws against the Poisoned condition. Concentration, up to 1 hour."
            confirmLabel="Cast Protection from Poison"
            confirmIcon="fa-shield-halved"
        />
    ),
    (p) => p.pendingStoneSkin && (
        <SecondaryTargetModal
            title="Stone Skin"
            targets={p.pendingStoneSkin.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={p.handleStoneSkinConfirm}
            onSkip={p.handleStoneSkinSkip}
            description="Choose a creature within range. The target has Resistance to Bludgeoning, Piercing, and Slashing damage. Concentration, up to 1 hour."
            confirmLabel="Cast Stone Skin"
            confirmIcon="fa-shield-halved"
        />
    ),
    (p) => p.pendingLongstrider && (
        <SecondaryTargetModal
            title="Longstrider"
            targets={p.pendingLongstrider.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={(targetName) => p.handleLongstriderConfirm([targetName])}
            onSkip={p.handleLongstriderSkip}
            description="You touch a creature. The target's Speed increases by 10 feet until the spell ends."
            confirmLabel="Cast Longstrider"
            confirmIcon="fa-boot"
        />
    ),
    (p) => p.pendingSpareTheDying && (
        <SecondaryTargetModal
            title="Spare the Dying"
            targets={p.pendingSpareTheDying.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={(targetName) => p.handleSpareTheDyingConfirm({ targetName })}
            onSkip={p.handleSpareTheDyingSkip}
            description="Choose a creature within range that has 0 Hit Points and isn't dead. The creature becomes Stable."
            confirmLabel="Cast Spare the Dying"
            confirmIcon="fa-hand-holding-medical"
        />
    ),
    (p) => p.pendingDeathWard && (
        <SecondaryTargetModal
            title="Death Ward"
            targets={p.pendingDeathWard.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={(targetName) => p.handleDeathWardConfirm([targetName])}
            onSkip={p.handleDeathWardSkip}
            description="Choose a willing creature within range. The target gains protection from death: the first time it would drop to 0 HP, it instead drops to 1 HP."
            confirmLabel="Cast Death Ward"
            confirmIcon="fa-shield-halved"
        />
    ),
    (p) => p.pendingHeroism && (
        <SecondaryTargetModal
            title="Heroism"
            targets={p.pendingHeroism.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={(targetName) => p.handleHeroismConfirm([targetName])}
            onSkip={p.handleHeroismSkip}
            description="Choose a willing creature within range. Target is immune to Frightened and gains temp HP at start of each turn."
            confirmLabel="Cast Heroism"
            confirmIcon="fa-dragon"
        />
    ),
    (p) => p.pendingHaste && (
        <SecondaryTargetModal
            title="Haste"
            targets={p.pendingHaste.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={(targetName) => p.handleHasteConfirm([targetName])}
            onSkip={p.handleHasteSkip}
            description="Choose a willing creature within range. Target's speed doubles, gains +2 AC, and gets advantage on DEX saves."
            confirmLabel="Cast Haste"
            confirmIcon="fa-bolt"
        />
    ),
    (p) => p.pendingEnhanceAbility && p.enhanceAbilityStage === 'ability' && (
        <HexAbilityModal
            onAbilitySelected={p.handleEnhanceAbilityAbilitySelect}
            onCancel={p.handleEnhanceAbilitySkip}
            abilities={[
                { key: 'STR', label: 'Strength' },
                { key: 'DEX', label: 'Dexterity' },
                { key: 'INT', label: 'Intelligence' },
                { key: 'WIS', label: 'Wisdom' },
                { key: 'CHA', label: 'Charisma' },
            ]}
            title="Enhance Ability — Choose Ability"
            prompt="Choose the ability that the target gains Advantage on ability checks with:"
            icon="fa-hand"
        />
    ),
    (p) => p.pendingEnhanceAbility && p.enhanceAbilityStage === 'target' && (
        <SecondaryTargetModal
            title="Enhance Ability"
            targets={p.pendingEnhanceAbility.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={(targetName) => p.handleEnhanceAbilityConfirm([targetName])}
            onSkip={p.handleEnhanceAbilitySkip}
            description="Choose a willing creature within range. The target gains Advantage on ability checks using the chosen ability for up to 1 hour (concentration)."
            confirmLabel="Cast Enhance Ability"
            confirmIcon="fa-hand"
        />
    ),
    (p) => p.pendingBarkskin && (
        <SecondaryTargetModal
            title="Barkskin"
            targets={p.pendingBarkskin.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={(targetName) => p.handleBarkskinConfirm([targetName])}
            onSkip={p.handleBarkskinSkip}
            description="Choose a willing creature within range. Target's AC becomes 17."
            confirmLabel="Cast Barkskin"
            confirmIcon="fa-tree"
        />
    ),
    (p) => p.pendingInvisibility && (
        <SecondaryTargetModal
            title="Invisibility"
            targets={p.pendingInvisibility.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={(targetName) => p.handleInvisibilityConfirm([targetName])}
            onSkip={p.handleInvisibilitySkip}
            description="Choose a creature within range. Target becomes invisible. Spell ends if target makes an attack roll, deals damage, casts a spell, or rolls initiative."
            confirmLabel="Cast Invisibility"
            confirmIcon="fa-eye-slash"
        />
    ),
    (p) => p.pendingGreaterInvisibility && (
        <SecondaryTargetModal
            title="Greater Invisibility"
            targets={p.pendingGreaterInvisibility.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={(targetName) => p.handleGreaterInvisibilityConfirm([targetName])}
            onSkip={p.handleGreaterInvisibilitySkip}
            description="Choose a creature within range. Target becomes invisible. Spell ends if target makes an attack roll, deals damage, casts a spell, or rolls initiative."
            confirmLabel="Cast Greater Invisibility"
            confirmIcon="fa-eye-slash"
        />
    ),
    (p) => p.pendingSanctuary && (
        <SecondaryTargetModal
            title="Sanctuary"
            targets={p.pendingSanctuary.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={(targetName) => p.handleSanctuaryConfirm(targetName)}
            onSkip={p.handleSanctuarySkip}
            description="Choose a creature within range. Until the spell ends, any creature who targets the warded creature with an attack roll or a damaging spell must succeed on a WIS save or lose the attack or spell. Does not protect from areas of effect. Spell ends if the warded creature makes an attack roll, casts a spell, or deals damage."
            confirmLabel="Cast Sanctuary"
            confirmIcon="fa-shield-halved"
        />
    ),
    (p) => p.pendingFeignDeath && (
        <SecondaryTargetModal
            title="Feign Death"
            targets={p.pendingFeignDeath.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={(targetName) => p.handleFeignDeathConfirm([targetName])}
            onSkip={p.handleFeignDeathSkip}
            description="Choose a creature within range. Target appears dead: Blinded, Incapacitated, Speed 0, Resistant to all damage except Psychic, Immune to Poisoned. Expires on initiative roll, short rest, or long rest."
            confirmLabel="Cast Feign Death"
            confirmIcon="fa-skull"
        />
    ),
    (p) => p.pendingHeal && (
        <SecondaryTargetModal
            title="Heal"
            targets={p.pendingHeal.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={(targetName) => p.handleHealConfirm({ targetName })}
            onSkip={p.handleHealSkip}
            description="A surge of positive energy washes through the creature, causing it to regain 70 hit points. This spell also ends blindness, deafness, and any diseases affecting the target."
            confirmLabel="Cast Heal"
            confirmIcon="fa-heart"
        />
    ),
    (p) => p.pendingRegenerate && (
        <SecondaryTargetModal
            title="Regenerate"
            targets={p.pendingRegenerate.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={(targetName) => p.handleRegenerateConfirm({ targetName })}
            onSkip={p.handleRegenerateSkip}
            description="A powerful healing spell that restores 4d8 + 15 hit points initially, then 1 hit point per turn. When the effect ends, the target is restored to full health."
            confirmLabel="Cast Regenerate"
            confirmIcon="fa-heart-pulse"
        />
    ),
    (p) => p.pendingHealingWord && (
        <SecondaryTargetModal
            title="Healing Word"
            targets={p.pendingHealingWord.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={(targetName) => p.handleHealingWordConfirm({ targetName })}
            onSkip={p.handleHealingWordSkip}
            description="Choose a creature within range. The target regains hit points equal to the roll of your dice plus your spellcasting ability modifier."
            confirmLabel="Cast Healing Word"
            confirmIcon="fa-heart"
        />
    ),
    (p) => p.pendingCureWounds && (
        <SecondaryTargetModal
            title="Cure Wounds"
            targets={p.pendingCureWounds.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={(targetName) => p.handleCureWoundsConfirm({ targetName })}
            onSkip={p.handleCureWoundsSkip}
            description="Choose a creature within touch range. The target regains hit points equal to the roll of your dice plus your spellcasting ability modifier."
            confirmLabel="Cast Cure Wounds"
            confirmIcon="fa-heart"
        />
    ),
    (p) => p.pendingRevivify && (
        <SecondaryTargetModal
            title="Revivify"
            targets={p.pendingRevivify.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={(targetName) => p.handleRevivifyConfirm({ targetName })}
            onSkip={p.handleRevivifySkip}
            description="Choose a creature to revive. The target must have 0 Hit Points. A diamond worth 300+ GP is consumed."
            confirmLabel="Cast Revivify"
            confirmIcon="fa-heart"
        />
    ),
    (p) => p.pendingGreaterRestoration && !p.pendingGreaterRestorationTarget && (
        <SecondaryTargetModal
            title="Greater Restoration"
            targets={p.pendingGreaterRestoration.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={async (targetName) => {
                const effects = await getEffectsForTarget(p.campaignName, targetName);
                p.setPendingGreaterRestorationTarget({ targetName, effects });
            }}
            onSkip={p.handleGreaterRestorationSkip}
            description={`Choose a creature within <strong>${p.pendingGreaterRestoration.range}</strong>. You'll select which debilitating effect to remove.`}
            confirmLabel="Cast Greater Restoration"
            confirmIcon="fa-hand-holding-medical"
        />
    ),
    (p) => p.pendingGreaterRestorationTarget && (
        <GreaterRestorationTargetPicker
            pendingGreaterRestorationTarget={p.pendingGreaterRestorationTarget}
            handleGreaterRestorationConfirm={p.handleGreaterRestorationConfirm}
            handleGreaterRestorationNoEffects={p.handleGreaterRestorationNoEffects}
            setPendingGreaterRestorationTarget={p.setPendingGreaterRestorationTarget}
        />
    ),
    (p) => p.pendingLesserRestoration && !p.pendingLesserRestorationTarget && (
        <SecondaryTargetModal
            title="Lesser Restoration"
            targets={p.pendingLesserRestoration.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={async (targetName) => {
                const conditions = await getConditionsForTarget(p.campaignName, targetName);
                p.setPendingLesserRestorationTarget({ targetName, conditions });
            }}
            onSkip={p.handleLesserRestorationSkip}
            description={`Choose a creature within <strong>${p.pendingLesserRestoration.range}</strong>. You'll select one condition to remove.`}
            confirmLabel="Cast Lesser Restoration"
            confirmIcon="fa-hand-holding-medical"
        />
    ),
    (p) => p.pendingLesserRestorationTarget && (
        <LesserRestorationTargetPicker
            pendingLesserRestorationTarget={p.pendingLesserRestorationTarget}
            handleLesserRestorationConfirm={p.handleLesserRestorationConfirm}
            handleLesserRestorationSkip={p.handleLesserRestorationSkip}
            setPendingLesserRestorationTarget={p.setPendingLesserRestorationTarget}
        />
    ),
    (p) => p.pendingRemoveCurse && (
        <SecondaryTargetModal
            title="Remove Curse"
            targets={p.pendingRemoveCurse.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={(targetName) => p.handleRemoveCurseConfirm({ targetName })}
            onSkip={p.handleRemoveCurseSkip}
            description={`Choose a creature within <strong>${p.pendingRemoveCurse.range}</strong>. This spell ends all curses affecting the target and breaks the target's attunement to any cursed magic items.`}
            confirmLabel="Cast Remove Curse"
            confirmIcon="fa-hand-holding-medical"
        />
    ),
    (p) => p.pendingMageArmor && (
        <SecondaryTargetModal
            title="Mage Armor"
            targets={p.pendingMageArmor.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={(targetName) => p.handleMageArmorConfirm([targetName])}
            onSkip={p.handleMageArmorSkip}
            description="Choose a creature within range. The target's base AC becomes 13 + Dexterity modifier. Mage Armor lasts 8 hours and ends on a long rest."
            confirmLabel="Cast Mage Armor"
            confirmIcon="fa-shield-halved"
        />
    ),
    (p) => p.pendingProtectionFromEnergy && p.protectionFromEnergyStage === 'target' && (
        <SecondaryTargetModal
            title="Protection from Energy"
            targets={p.pendingProtectionFromEnergy.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={p.handleProtectionFromEnergyTargetSelect}
            onSkip={p.handleProtectionFromEnergySkip}
            description={`Choose a creature within <strong>${p.pendingProtectionFromEnergy.range}</strong>. Then choose a damage type for resistance.`}
            confirmLabel="Cast Protection from Energy"
            confirmIcon="fa-shield-halved"
        />
    ),
    (p) => p.pendingProtectionFromEnergy && p.protectionFromEnergyStage === 'type' && (
        <SingleResistanceSelectionModal
            title="Choose Damage Type"
            icon="fa-shield-halved"
            action={{ automation: { damageTypes: p.pendingProtectionFromEnergy.damageTypes } }}
            playerStats={p.playerStats}
            campaignName={p.campaignName}
            onConfirm={p.handleProtectionFromEnergyTypeSelect}
            onClose={p.handleProtectionFromEnergySkip}
        />
    ),
    (p) => p.pendingResistance && p.resistanceStage === 'target' && (
        <SecondaryTargetModal
            title="Resistance"
            targets={p.pendingResistance.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={p.handleResistanceTargetSelect}
            onSkip={p.handleResistanceSkip}
            description={`Choose a creature within <strong>${p.pendingResistance.range}</strong>. Then choose a damage type to reduce.`}
            confirmLabel="Cast Resistance"
            confirmIcon="fa-shield-halved"
        />
    ),
    (p) => p.pendingResistance && p.resistanceStage === 'type' && (
        <SingleResistanceSelectionModal
            title="Choose Damage Type"
            icon="fa-shield-halved"
            action={{ automation: { damageTypes: p.pendingResistance.damageTypes } }}
            playerStats={p.playerStats}
            campaignName={p.campaignName}
            onConfirm={p.handleResistanceTypeSelect}
            onClose={p.handleResistanceSkip}
        />
    ),
    (p) => p.pendingHex && (
        <SecondaryTargetModal
            title="Hex"
            targets={p.pendingHex.creatureTargets.map(name => ({ name, type: 'creature' }))}
            onTargetSelected={p.handleHexConfirm}
            onSkip={p.handleHexSkip}
            description="Choose a creature within 90 feet that you can see. You'll then select an ability for the target to have Disadvantage on."
            confirmLabel="Select Target"
            confirmIcon="fa-crown"
        />
    ),
];

const TargetSpellPopups = function TargetSpellPopups(props) {
    return (
        <>
            {TARGET_SPELL_POPUP_RENDERERS.map((render, i) => (
                <React.Fragment key={i}>{render(props)}</React.Fragment>
            ))}
        </>
    );
};

export default TargetSpellPopups;
