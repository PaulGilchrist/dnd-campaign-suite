import React from 'react';
import CreatureSelectionModal from '../modals/shared/CreatureSelectionModal.jsx';
import PolymorphSelectionModal from '../modals/PolymorphSelectionModal.jsx';
import TruePolymorphPathModal from '../modals/TruePolymorphPathModal.jsx';
import { confirmShapechangeTransform } from '../../../services/automation/handlers/spells/shapechangeService.js';
import { prepareSpellCast, isFreeCastAuthorized } from '../../../services/rules/spells/spellPreparationService.js';

function renderCreaturePopup(spec) {
    if (!spec.guard) return null;
    return (
        <CreatureSelectionModal
            key={spec.key || spec.title}
            title={spec.title}
            icon={spec.icon}
            targets={spec.targets(spec.guard)}
            maxTargets={spec.maxTargets ? spec.maxTargets(spec.guard) : undefined}
            description={spec.description}
            confirmLabel={spec.confirmLabel}
            confirmIcon={spec.confirmIcon}
            onConfirm={spec.onConfirm}
            onSkip={spec.onSkip}
        />
    );
}

const creatureTargets = (flow) => flow.creatureTargets;
const flowMaxTargets = (flow) => flow.maxTargets;
const beastTargets = (flow) => flow.creatureTargets.map(name => ({ name, type: 'beast' }));
const auraMaxTargets = () => 5;

const CREATURE_POPUP_RENDERERS = [
    (h) => ({ guard: h.flowHoldMonster, title: 'Hold Monster', icon: 'fa-hand-back-fist', targets: creatureTargets, maxTargets: flowMaxTargets, description: "Choose a creature that you can see within range. The target must succeed on a Wisdom saving throw or have the Paralyzed condition for the duration. At the end of each of its turns, the target repeats the save, ending the spell on itself on a success. Concentration, up to 1 minute.", confirmLabel: 'Cast Hold Monster', confirmIcon: 'fa-hand-back-fist', onConfirm: h.handleHoldMonsterConfirm, onSkip: h.handleHoldMonsterSkip }),
    (h) => ({ guard: h.flowHoldPerson, title: 'Hold Person', icon: 'fa-hand-back-fist', targets: creatureTargets, maxTargets: flowMaxTargets, description: "Choose a Humanoid that you can see within range. The target must succeed on a Wisdom saving throw or have the Paralyzed condition for the duration. At the end of each of its turns, the target repeats the save, ending the spell on itself on a success. Concentration, up to 1 minute.", confirmLabel: 'Cast Hold Person', confirmIcon: 'fa-hand-back-fist', onConfirm: h.handleHoldPersonConfirm, onSkip: h.handleHoldPersonSkip }),
    (h) => ({ guard: h.flowPolymorph, title: 'Polymorph', icon: 'fa-paw', targets: creatureTargets, maxTargets: flowMaxTargets, description: "Choose a creature you can see within range. The target must succeed on a Wisdom saving throw or be transformed into a beast whose Challenge Rating is equal to or less than the target's Challenge Rating or level. The spell has no effect on a shapechanger or a creature with 0 hit points. Concentration, up to 1 hour.", confirmLabel: 'Cast Polymorph', confirmIcon: 'fa-paw', onConfirm: h.handlePolymorphConfirm, onSkip: h.handlePolymorphSkip }),
];

const ANIMAL_SHAPES_RENDERERS = [
    (h) => ({ guard: h.flowAnimalShapes, title: 'Animal Shapes', icon: 'fa-paw', targets: creatureTargets, description: 'Choose any number of willing creatures you can see within range. Each target will be transformed into a beast of your choice (CR 4 or lower, Small or Large). No concentration required. Duration: 24 hours.', confirmLabel: 'Cast Animal Shapes', confirmIcon: 'fa-paw', onConfirm: h.handleAnimalShapesTargetConfirm, onSkip: h.handleAnimalShapesSkip }),
];

const LATE_CREATURE_POPUP_RENDERERS = [
    (h) => ({ key: 'true-polymorph-creature', guard: h.flowTruePolymorph?.path === 'creature_to_creature' ? h.flowTruePolymorph : null, title: 'True Polymorph', icon: 'fa-paw', targets: creatureTargets, maxTargets: flowMaxTargets, description: "Choose a creature you can see within range. The target must succeed on a Wisdom saving throw or be transformed into a creature of your choice whose Challenge Rating is equal to or less than the target's Challenge Rating or level. The spell has no effect on a shapechanger or a creature with 0 hit points. Concentration, up to 1 hour.", confirmLabel: 'Cast True Polymorph', confirmIcon: 'fa-paw', onConfirm: h.handleTruePolymorphTargetConfirm, onSkip: h.handleTruePolymorphSkip }),
    (h) => ({ key: 'true-polymorph-object', guard: h.flowTruePolymorph?.path === 'creature_to_object' ? h.flowTruePolymorph : null, title: 'True Polymorph', icon: 'fa-paw', targets: creatureTargets, maxTargets: flowMaxTargets, description: 'Choose a creature you can see within range. The target is transformed into a nonmagical object. The target gains the incapacitated condition. Concentration, up to 1 hour.', confirmLabel: 'Cast True Polymorph', confirmIcon: 'fa-paw', onConfirm: h.handleTruePolymorphTargetConfirm, onSkip: h.handleTruePolymorphSkip }),
    (h) => ({ guard: h.flowCharmPerson, title: 'Charm Person', icon: 'fa-heart', targets: creatureTargets, maxTargets: flowMaxTargets, description: "Choose a Humanoid that you can see within range. The target must succeed on a Wisdom saving throw or have the Charmed condition for the duration. The charmed creature regards you as a friendly acquaintance. The spell ends if you or your companions do anything harmful to the target.", confirmLabel: 'Cast Charm Person', confirmIcon: 'fa-heart', onConfirm: h.handleCharmPersonConfirm, onSkip: h.handleCharmPersonSkip }),
    (h) => ({ guard: h.flowCharmMonster, title: 'Charm Monster', icon: 'fa-heart', targets: creatureTargets, maxTargets: flowMaxTargets, description: "Choose a creature that you can see within range. The target must succeed on a Wisdom saving throw or have the Charmed condition for the duration. The charmed creature regards you as a friendly acquaintance. The spell ends if you or your companions do anything harmful to the target.", confirmLabel: 'Cast Charm Monster', confirmIcon: 'fa-heart', onConfirm: h.handleCharmMonsterConfirm, onSkip: h.handleCharmMonsterSkip }),
    (h) => ({ guard: h.flowBanishment, title: 'Banishment', icon: 'fa-door-open', targets: creatureTargets, maxTargets: flowMaxTargets, description: 'Choose a creature that you can see within range. The target must succeed on a Charisma saving throw or be transported to a harmless demiplane for the duration. While there, the target has the Incapacitated condition. Concentration, up to 1 minute.', confirmLabel: 'Cast Banishment', confirmIcon: 'fa-door-open', onConfirm: h.handleBanishmentConfirm, onSkip: h.handleBanishmentSkip }),
    (h) => ({ guard: h.flowPrismaticSpray, title: 'Prismatic Spray', icon: 'fa-eye', targets: creatureTargets, maxTargets: flowMaxTargets, description: 'Eight rays of light flash from you in a 60-foot Cone. Each creature in the Cone makes a DEX saving throw. For each target, roll 2d7 to determine which ray affects it. Choose creatures in the cone.', confirmLabel: 'Cast Prismatic Spray', confirmIcon: 'fa-eye', onConfirm: h.handlePrismaticSprayConfirm, onSkip: h.handlePrismaticSpraySkip }),
    (h) => ({ guard: h.pendingHeroesFeast, title: "Heroes' Feast", icon: 'fa-champagne-glasses', targets: creatureTargets, maxTargets: flowMaxTargets, description: 'You conjure a feast that benefits up to twelve creatures. Each target gains resistance to Poison damage, immunity to the Frightened and Poisoned conditions, and their Hit Point maximum increases by 2d10. These benefits last 24 hours.', confirmLabel: "Cast Heroes' Feast", onConfirm: h.handleHeroesFeastConfirm, onSkip: h.handleHeroesFeastSkip }),
    (h) => ({ guard: h.pendingBane, title: 'Bane', icon: 'fa-shield-halved', targets: creatureTargets, maxTargets: flowMaxTargets, description: 'Curse up to three creatures of your choice that you can see within range. Affected creatures subtract 1d4 from attack rolls and saving throws.', confirmLabel: 'Cast Bane', onConfirm: h.handleBaneConfirm, onSkip: h.handleBaneSkip }),
    (h) => ({ guard: h.pendingBless, title: 'Bless', icon: 'fa-hands', targets: creatureTargets, maxTargets: flowMaxTargets, description: 'You bless up to three creatures of your choice within range. Affected creatures add 1d4 to attack rolls and saving throws.', confirmLabel: 'Cast Bless', onConfirm: h.handleBlessConfirm, onSkip: h.handleBlessSkip }),
    (h) => ({ guard: h.pendingFaerieFire, title: 'Faerie Fire', icon: 'fa-fire', targets: creatureTargets, description: "Each creature in a 20-foot Cube within range must succeed on a Dexterity saving throw or be outlined in light for the duration. Affected creatures shed Dim Light in a 10-foot radius, can't benefit from the Invisible condition, and attack rolls against them have Advantage if the attacker can see them. Concentration, up to 1 minute.", confirmLabel: 'Cast Faerie Fire', confirmIcon: 'fa-fire', onConfirm: h.handleFaerieFireConfirm, onSkip: h.handleFaerieFireSkip }),
    (h) => ({ guard: h.pendingHolyAura, title: 'Holy Aura', icon: 'fa-sun', targets: creatureTargets, description: 'You emit an aura in a 30-foot Emanation. While in the aura, creatures of your choice have Advantage on all saving throws, and other creatures have Disadvantage on attack rolls against them. In addition, when a Fiend or an Undead hits an affected creature with a melee attack roll, the attacker must succeed on a Constitution saving throw or be Blinded until the end of its next turn.', confirmLabel: 'Cast Holy Aura', onConfirm: h.handleHolyAuraConfirm, onSkip: h.handleHolyAuraSkip }),
    (h) => ({ guard: h.pendingBeaconOfHope, title: 'Beacon of Hope', icon: 'fa-star-of-life', targets: creatureTargets, description: 'Choose any number of creatures within range. Targets gain advantage on WIS saving throws and death saves, and regain maximum HP when healed.', confirmLabel: 'Cast Beacon of Hope', onConfirm: h.handleBeaconOfHopeConfirm, onSkip: h.handleBeaconOfHopeSkip }),
    (h) => ({ guard: h.pendingSlow, title: 'Slow', icon: 'fa-clock', targets: creatureTargets, description: 'Choose a creature within range. The target must make a WIS saving throw or be affected by Slow: Speed halved, -2 AC penalty, disadvantage on DEX saves, no reactions, action or bonus action (not both), one attack max, 25% somatic spell failure chance. Repeats WIS save at end of each turn.', confirmLabel: 'Cast Slow', onConfirm: h.handleSlowConfirm, onSkip: h.handleSlowSkip }),
    (h) => ({ guard: h.pendingPassWithoutTrace, title: 'Pass Without Trace', icon: 'fa-ghost', targets: creatureTargets, description: "A veil of shadows and silence radiates from you, masking you and your companions from detection. Choose creatures within 30 feet of you. Each chosen creature has a +10 bonus to Dexterity (Stealth) checks and can't be tracked except by magical means.", confirmLabel: 'Cast Pass Without Trace', onConfirm: h.handlePassWithoutTraceConfirm, onSkip: h.handlePassWithoutTraceSkip }),
    (h) => ({ guard: h.pendingGlobe, title: 'Globe of Invulnerability', icon: 'fa-shield-halved', targets: creatureTargets, description: 'Choose creatures within 10 feet to protect by the globe barrier. All creatures inside the barrier are protected from spells of 5th level or lower from outside the globe.', confirmLabel: 'Activate Globe', onConfirm: h.handleGlobeConfirm, onSkip: h.handleGlobeSkip }),
    (h) => ({ guard: h.pendingAntimagicField, title: 'Antimagic Field', icon: 'fa-shield-halved', targets: creatureTargets, description: 'Select all creatures within the 10-foot radius of the antimagic field. The caster is included by default. Only weapon attacks are allowed within the field — all magic and spells are suppressed.', confirmLabel: 'Cast Antimagic Field', onConfirm: h.handleAntimagicFieldConfirm, onSkip: h.handleAntimagicFieldSkip }),
    (h) => ({ guard: h.pendingForcecage, title: 'Forcecage', icon: 'fa-dungeon', targets: creatureTargets, description: "Select the creatures completely inside the prison to trap. Trapped creatures can't leave by nonmagical means. No attack, spell, or effect can pass between inside and outside the prison. Each trapped creature can attempt a CHA save to use teleportation or interplanar travel to exit. Concentration, up to 1 hour.", confirmLabel: 'Cast Forcecage', onConfirm: h.handleForcecageConfirm, onSkip: h.handleForcecageSkip }),
    (h) => ({ guard: h.pendingStinkingCloud, title: 'Stinking Cloud', icon: 'fa-cloud', targets: creatureTargets, description: 'A 20-foot-radius sphere of yellow, nauseating gas appears. Each creature in the area must make a CON save or become Poisoned. The cloud is heavily obscured. Concentration, up to 1 minute. Expires on concentration loss, initiative roll, short rest, or long rest.', confirmLabel: 'Cast Stinking Cloud', onConfirm: h.handleStinkingCloudConfirm, onSkip: h.handleStinkingCloudSkip }),
    (h) => ({ guard: h.pendingConfusion, title: 'Confusion', icon: 'fa-circle-notch', targets: creatureTargets, description: 'A 10-foot-radius sphere of swirling chaos appears at a point within range. Each creature in the area must make a WIS save or become Charmed and unable to take Bonus Actions or Reactions. At the start of each turn, a confused creature rolls 1d10 for behavior. End of turn: repeat WIS save (DC {dc}); success ends the spell. Concentration, up to 1 minute.', confirmLabel: 'Cast Confusion', confirmIcon: 'fa-circle-notch', onConfirm: h.handleConfusionConfirm, onSkip: h.handleConfusionSkip }),
    (h) => ({ guard: h.pendingWeb, title: 'Web', icon: 'fa-spider-web', targets: creatureTargets, description: 'A 20-foot cube of sticky webbing appears at a point within range. Each creature in the area must make a DEX save or become Restrained. The webs are difficult terrain and lightly obscured. Concentration, up to 1 hour. STR save each turn or remain Restrained. Restrained creatures can use action for STR (Athletics) check vs DC to break free.', confirmLabel: 'Cast Web', onConfirm: h.handleWebConfirm, onSkip: h.handleWebSkip }),
    (h) => ({ guard: h.pendingAnimalFriendship, title: 'Animal Friendship', icon: 'fa-paw', targets: beastTargets, maxTargets: (flow) => flow.spellLevel, description: 'This spell lets you convince a beast that you mean it no harm. Choose a beast that you can see within range. It must see and hear you. The target must succeed on a WIS saving throw or be charmed by you for the duration. If you or one of your allies deals damage to the target, the spell ends. You can target one additional Beast for each spell slot level above 1.', confirmLabel: 'Cast Animal Friendship', onConfirm: h.handleAnimalFriendshipConfirm, onSkip: h.handleAnimalFriendshipSkip }),
    (h) => ({ guard: h.pendingAuraOfLife, title: 'Aura of Life', icon: 'fa-heart-pulse', targets: creatureTargets, maxTargets: auraMaxTargets, description: "Choose up to 5 willing creatures within 30 feet. Each target gains resistance to necrotic damage, their hit point maximum can't be reduced, and they regain 1 HP at the start of their turn if they have 0 HP.", confirmLabel: 'Cast Aura of Life', onConfirm: h.handleAuraOfLifeConfirm, onSkip: h.handleAuraOfLifeSkip }),
    (h) => ({ guard: h.pendingAuraOfPurity, title: 'Aura of Purity', icon: 'fa-shield-halved', targets: creatureTargets, maxTargets: auraMaxTargets, description: 'Choose up to 5 willing creatures within 30 feet. Each target gains resistance to Poison damage and Advantage on saving throws to avoid or end effects that include the Blinded, Charmed, Deafened, Frightened, Paralyzed, Poisoned, or Stunned condition.', confirmLabel: 'Cast Aura of Purity', onConfirm: h.handleAuraOfPurityConfirm, onSkip: h.handleAuraOfPuritySkip }),
    (h) => ({ guard: h.pendingCircleOfPower, title: 'Circle of Power', icon: 'fa-shield-halved', targets: creatureTargets, maxTargets: auraMaxTargets, description: 'An aura radiates from you in a 30-foot Emanation. Choose up to 5 creatures within the aura (including yourself). Each target gains Advantage on saving throws against spells and other magical effects, and takes no damage on a successful save against effects that allow half damage. Concentration, up to 10 minutes.', confirmLabel: 'Cast Circle of Power', onConfirm: h.handleCircleOfPowerConfirm, onSkip: h.handleCircleOfPowerSkip }),
    (h) => ({ guard: h.pendingCompulsion, title: 'Compulsion', icon: 'fa-people-arrows', targets: creatureTargets, description: 'Choose creatures within 30 feet. Each target must make a WIS saving throw or become Charmed. As a bonus action on each of its turns, the charmed creature must use its movement to travel to the nearest space that is furthest away from you. Concentration, up to 1 minute. Expires on concentration loss, initiative roll, short rest, or long rest.', confirmLabel: 'Cast Compulsion', onConfirm: h.handleCompulsionConfirm, onSkip: h.handleCompulsionSkip }),
    (h) => ({ guard: h.pendingSleetStorm, title: 'Sleet Storm', icon: 'fa-snowflake', targets: creatureTargets, description: 'Sleet falls in a 40-foot-tall, 20-foot-radius Cylinder within range. The area is Heavily Obscured. When a creature enters the Cylinder for the first time on a turn or starts its turn there, it must succeed on a DEX saving throw or have the Prone condition and lose Concentration. Concentration, up to 1 minute.', confirmLabel: 'Cast Sleet Storm', confirmIcon: 'fa-snowflake', onConfirm: h.handleSleetStormConfirm, onSkip: h.handleSleetStormSkip }),
];

const CreatureTargetPopups = function CreatureTargetPopups(props) {
    const {
        playerStats,
        campaignName,
        flowTruePolymorph,
        pendingShapechange,
        handleTruePolymorphPathSelect,
        handleTruePolymorphSkip,
    } = props;

    const handleShapechangeConfirm = async (form) => {
        const isCantrip = pendingShapechange.spell.level === 0;
        if (!isCantrip) {
            const freeCastAuthorized = isFreeCastAuthorized(playerStats.name, pendingShapechange.spell.name, pendingShapechange.spell.level, playerStats, campaignName);
            const isUpcast = pendingShapechange.spell.isUpcast;
            const upcastLevel = pendingShapechange.spell.upcastLevel;
            await prepareSpellCast(pendingShapechange.spell, {}, {
                playerName: playerStats.name,
                playerStats,
                campaignName,
                isUpcast,
                upcastLevel,
                freeCastAuthorized,
            });
        }
        await confirmShapechangeTransform({
            targetName: playerStats.name,
            form,
            casterName: playerStats.name,
            spell: pendingShapechange.spell,
            spellLevel: pendingShapechange.spellLevel,
            playerStats,
            campaignName,
        });
    };

    return (
        <>
            {CREATURE_POPUP_RENDERERS.map((build) => renderCreaturePopup(build(props)))}
            {pendingShapechange && (
                <PolymorphSelectionModal
                    playerStats={playerStats}
                    maxCR={playerStats.level}
                    campaignName={campaignName}
                    title="Shapechange"
                    icon="fa-paw"
                    actionLabel="Shapechange"
                    allowAnyCreature={true}
                    excludeTypes={['construct', 'undead']}
                    onConfirm={handleShapechangeConfirm}
                    onCancel={() => {}}
                />
            )}
            {ANIMAL_SHAPES_RENDERERS.map((build) => renderCreaturePopup(build(props)))}
            {flowTruePolymorph && !flowTruePolymorph.path && (
                <TruePolymorphPathModal
                    onConfirm={handleTruePolymorphPathSelect}
                    onCancel={handleTruePolymorphSkip}
                />
            )}
            {LATE_CREATURE_POPUP_RENDERERS.map((build) => renderCreaturePopup(build(props)))}
        </>
    );
};

export default CreatureTargetPopups;
