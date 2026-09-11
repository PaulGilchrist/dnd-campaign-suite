
import React from 'react'
import { cloneDeep } from 'lodash';
import useActionPopup from '../../../hooks/combat/useActionPopup.js'
import useLoggedDiceRoll from '../../../hooks/combat/useLoggedDiceRoll.js'
import { useDiceRollPopup } from '../../../hooks/combat/DiceRollContext.js'
import CharSpellSlots from './CharSpellSlots.jsx'
import SpellTargetPopups from './SpellTargetPopups.jsx'
import CreatureTargetPopups from './CreatureTargetPopups.jsx'
import TargetSpellPopups from './TargetSpellPopups.jsx'
import { getExcludedSpellNames, isSpellBreakerBonusActionSpell } from '../../../services/ui/spellSectionUtils.js'
import { useSpellMetamagicFlow } from '../../../hooks/combat/useSpellMetamagicFlow.js'
import { useSpellUpcastFlow } from '../../../hooks/combat/useSpellUpcastFlow.js'
import { useSpellCastExecutor } from '../../../hooks/combat/useSpellCastExecutor.js';
import { useSpellPositionResolver } from '../../../hooks/combat/useSpellPositionResolver.js';
import { isInnateSorceryActive } from '../../../services/combat/buffs/buffService.js';
import { getTargetFromAttacker, getCombatContext, getAttackerTargetName } from '../../../services/rules/combat/damageUtils.js';
import { useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { normalizeAutoDamage, resolveAttackDamageStandalone } from '../useAttackDamageResolution.js';
import './CharSpells.css'

function resolveSpellDamageDisplay(spell, dmgObj, playerStats) {
    const isCantrip = spell.level === 0;
    let damageDisplay = isCantrip ? dmgObj[Math.max(...Object.keys(dmgObj).map(Number).filter(l => l <= playerStats.level))] || dmgObj[Object.keys(dmgObj)[0]] : dmgObj[Object.keys(dmgObj)[0]];
    if (spell.name === "Hunter's Mark" && playerStats.class?.name === 'Ranger' && playerStats.level >= 20) {
        damageDisplay = damageDisplay.replace('1d6', '1d10');
    }
    return damageDisplay;
}

function computeSpellEffectLabel(spell, playerStats) {
    if (spell.damage) {
        const slotDmg = spell.damage.damage_at_slot_level;
        const charDmg = spell.damage.damage_at_character_level;
        const dmgObj = slotDmg && Object.keys(slotDmg).length ? slotDmg : charDmg;
        if (!dmgObj) return 'Utility';
        const damageDisplay = resolveSpellDamageDisplay(spell, dmgObj, playerStats);
        let effect = `${damageDisplay} ${spell.damage.damage_type}`;
        if (spell.dc) {
            const saveLabel = spell.dc.dc_success === 'half' ? 'half' : 'negates';
            effect += ` (${spell.dc.dc_type} ${saveLabel})`;
        }
        return effect;
    }
    if (spell.dc) {
        const saveLabel = spell.dc.dc_success === 'half' ? 'half' : spell.dc.dc_success === 'negates' ? 'negates' : '';
        return spell.dc.dc_type + (saveLabel ? ` ${saveLabel}` : '');
    }
    return 'Utility';
}

function formatSpellCastingTime(playerStats, spell) {
    // CLA-322: Spell Breaker shows Dispel Magic as Bonus Action
    const ct = isSpellBreakerBonusActionSpell(playerStats, spell.name) ? 'bonus action' : spell.casting_time;
    return ct ? ct.replace(/\bbonus action\b/g, 'BA').replace(/\baction\b/g, ' A').replace(/\breaction\b/g, 'Reaction').replace(/\bminute\b/g, 'min').replace(/\bminutes\b/g, 'min') : '';
}

function formatSpellDuration(spell) {
    if (!spell.duration) return '';
    return spell.duration.replace('Instantaneous','Instant').replace('minute','min').replace('minutes','min').replace('up to ','');
}

function SpellPreparedCell({ spell, handleTogglePreparedSpells }) {
    if (spell.prepared !== 'Prepared' && spell.prepared !== '') return <td>{spell.prepared}</td>;
    return <td><input tabIndex={0} type="checkbox" checked={spell.prepared === 'Prepared'} onChange={() => handleTogglePreparedSpells(spell.name)}/></td>;
}

const CharSpells = function CharSpells({ playerStats, handleTogglePreparedSpells, campaignName, exhaustionPenalty = 0, conditionAttackMode, cannotAct, mapName, characters, setModalState }) {
    const _activeBuffs = useRuntimeValue(playerStats.name, 'activeBuffs', campaignName); (void _activeBuffs); // subscribe to activeBuffs changes for re-render
    const innateSorceryActive = isInnateSorceryActive(playerStats.name, campaignName);
    useActionPopup('spell');
    const { setPopupHtml } = useDiceRollPopup();
    const [wordsOfCreationTarget, setWordsOfCreationTarget] = React.useState(null);
    const { rollAttack, rollDamage } = useLoggedDiceRoll(playerStats.name, campaignName, {
        characters,
        autoDamageSource: 'char-spells',
        autoDamageRoll: async (autoDamage, isCrit) => {
            const { attack, ctx: ctxOverrides } = normalizeAutoDamage(autoDamage, isCrit, playerStats);
            await resolveAttackDamageStandalone(attack, ctxOverrides, { playerStats, campaignName, setPopupHtml, rollDamage, setModalState: () => {} });
        },
    });
    const [selectedSpell, setSelectedSpell] = React.useState(null);
    const [pendingGreaterRestorationTarget, setPendingGreaterRestorationTarget] = React.useState(null);
    const [pendingLesserRestorationTarget, setPendingLesserRestorationTarget] = React.useState(null);
    const isSorcerer = playerStats.class?.name === 'Sorcerer';
    const isWizard = playerStats.class?.name === 'Wizard';

    const { resolvePositions: resolveSpellPositions, cachedPosRef: cachedCastPosRef } = useSpellPositionResolver(campaignName, mapName, playerStats.name);

    const getTargetInfo = React.useCallback(async () => {
        const cs = await getCombatContext(campaignName);
        if (!cs) return null;
        const target = getTargetFromAttacker(cs, playerStats.name);
        if (target) return target;
        const overlayTargetName = getAttackerTargetName(cs, playerStats.name);
        if (overlayTargetName) return { name: overlayTargetName };
        return null;
    }, [playerStats.name, campaignName]);

    const { castAction } = useSpellCastExecutor(rollAttack, rollDamage, playerStats, getTargetInfo, campaignName, mapName, characters, setPopupHtml, {}, cachedCastPosRef, setModalState);

    const { pendingMetamagic, pendingMultiTarget, gateMetamagic, handleConfirm, handleSkip, handleMultiTargetConfirm, handleMultiTargetSkip, pendingHeroesFeast, handleHeroesFeastConfirm, handleHeroesFeastSkip, pendingGreaterRestoration, handleGreaterRestorationConfirm, handleGreaterRestorationSkip, handleGreaterRestorationNoEffects, pendingLesserRestoration, handleLesserRestorationConfirm, handleLesserRestorationSkip, pendingMageArmor, handleMageArmorConfirm, handleMageArmorSkip, pendingBane, handleBaneConfirm, handleBaneSkip, pendingBless, handleBlessConfirm, handleBlessSkip, pendingFaerieFire, handleFaerieFireConfirm, handleFaerieFireSkip, pendingHolyAura, handleHolyAuraConfirm, handleHolyAuraSkip, pendingBeaconOfHope, handleBeaconOfHopeConfirm, handleBeaconOfHopeSkip, pendingSlow, handleSlowConfirm, handleSlowSkip, pendingHaste, handleHasteConfirm, handleHasteSkip, pendingEnhanceAbility, enhanceAbilityStage, handleEnhanceAbilityAbilitySelect, handleEnhanceAbilityConfirm, handleEnhanceAbilitySkip, pendingBarkskin, handleBarkskinConfirm, handleBarkskinSkip, pendingInvisibility, handleInvisibilityConfirm, handleInvisibilitySkip, pendingGreaterInvisibility, handleGreaterInvisibilityConfirm, handleGreaterInvisibilitySkip, pendingFeignDeath, handleFeignDeathConfirm, handleFeignDeathSkip, pendingHeal, handleHealConfirm, handleHealSkip, pendingProtectionFromEvilAndGood, handleProtectionFromEvilAndGoodConfirm, handleProtectionFromEvilAndGoodSkip, pendingProtectionFromPoison, handleProtectionFromPoisonConfirm, handleProtectionFromPoisonSkip, pendingStoneSkin, handleStoneSkinConfirm, handleStoneSkinSkip, pendingProtectionFromEnergy, protectionFromEnergyStage, handleProtectionFromEnergyTargetSelect, handleProtectionFromEnergyTypeSelect, handleProtectionFromEnergySkip, pendingResistance, resistanceStage, handleResistanceTargetSelect, handleResistanceTypeSelect, handleResistanceSkip, pendingRemoveCurse, handleRemoveCurseConfirm, handleRemoveCurseSkip, pendingMagicMissile, handleMagicMissileConfirm, handleMagicMissileSkip, pendingPassWithoutTrace, handlePassWithoutTraceConfirm, handlePassWithoutTraceSkip, pendingGlobe, handleGlobeConfirm, handleGlobeSkip, pendingForcecage, handleForcecageConfirm, handleForcecageSkip, pendingAntimagicField, handleAntimagicFieldConfirm, handleAntimagicFieldSkip, pendingRegenerate, handleRegenerateConfirm, handleRegenerateSkip, pendingHealingWord, handleHealingWordConfirm, handleHealingWordSkip, pendingCureWounds, handleCureWoundsConfirm, handleCureWoundsSkip, pendingStinkingCloud, handleStinkingCloudConfirm, handleStinkingCloudSkip, pendingWeb, handleWebConfirm, handleWebSkip, pendingAnimalFriendship, handleAnimalFriendshipConfirm, handleAnimalFriendshipSkip, pendingAuraOfLife, handleAuraOfLifeConfirm, handleAuraOfLifeSkip, pendingAuraOfPurity, handleAuraOfPurityConfirm, handleAuraOfPuritySkip, pendingCircleOfPower, handleCircleOfPowerConfirm, handleCircleOfPowerSkip, pendingCompulsion, handleCompulsionConfirm, handleCompulsionSkip, pendingAuraOfVitality, handleAuraOfVitalityConfirm, handleAuraOfVitalitySkip, pendingForesight, handleForesightConfirm, handleForesightSkip, pendingLongstrider, handleLongstriderConfirm, handleLongstriderSkip, pendingSpareTheDying, handleSpareTheDyingConfirm, handleSpareTheDyingSkip,     pendingConfusion, handleConfusionConfirm, handleConfusionSkip, pendingDeathWard, handleDeathWardConfirm, handleDeathWardSkip,     pendingHeroism, handleHeroismConfirm, handleHeroismSkip, pendingHex, handleHexConfirm, handleHexSkip,   pendingHoldMonster: flowHoldMonster, pendingHoldPerson: flowHoldPerson, handleHoldMonsterConfirm, handleHoldMonsterSkip, handleHoldPersonConfirm, handleHoldPersonSkip,     pendingPolymorph: flowPolymorph, handlePolymorphConfirm, handlePolymorphSkip, pendingShapechange: pendingShapechange, pendingAnimalShapes: flowAnimalShapes, handleAnimalShapesTargetConfirm, handleAnimalShapesSkip, pendingTruePolymorph: flowTruePolymorph, handleTruePolymorphPathSelect, handleTruePolymorphTargetConfirm, handleTruePolymorphSkip, pendingCharmPerson: flowCharmPerson, handleCharmPersonConfirm, handleCharmPersonSkip, pendingCharmMonster: flowCharmMonster, handleCharmMonsterConfirm, handleCharmMonsterSkip,         pendingBanishment: flowBanishment, handleBanishmentConfirm, handleBanishmentSkip, pendingPrismaticSpray: flowPrismaticSpray, handlePrismaticSprayConfirm, handlePrismaticSpraySkip, pendingRevivify, handleRevivifyConfirm, handleRevivifySkip, pendingSanctuary, handleSanctuaryConfirm, handleSanctuarySkip, pendingSleetStorm, handleSleetStormConfirm, handleSleetStormSkip } = useSpellMetamagicFlow(playerStats, campaignName, castAction, setWordsOfCreationTarget, characters, setPopupHtml);
    const { pendingUpcast, buildUpcastLevels, handleUpcastConfirm, handleUpcastCancel } = useSpellUpcastFlow(playerStats, campaignName);

    const handleSpellCast = React.useCallback(async (spell, metaCtx) => {
        setSelectedSpell(null);
        await resolveSpellPositions();

        gateMetamagic(spell, metaCtx);
    }, [gateMetamagic, resolveSpellPositions]);

    const [filterPrepared, setFilterPrepared] = React.useState(false);
    const [spells, setSpells] = React.useState([]);
    const is2024 = playerStats.rules === '2024';
    // Only 5e shows the prepared column for everyone; in 2024 it's Wizard-only (spellbook vs prepared).
    const showPreparedColumn = !is2024 || (is2024 && isWizard);

    React.useEffect(() => {
        if(playerStats.spellAbilities) {
            setFilterPrepared(false);
            const excludedSpellNames = getExcludedSpellNames(playerStats, campaignName);
            const allSpells = playerStats.spellAbilities.spells;
            setSpells(allSpells.filter(spell => !excludedSpellNames.has(spell.name)));
          }
      }, [playerStats, campaignName]);
    const handleTogglePreparedFilter = () => {
        const excludedSpellNames = getExcludedSpellNames(playerStats, campaignName);
        const spells = cloneDeep(playerStats.spellAbilities.spells);
        if(!filterPrepared) {
            const filtered = spells.filter(spell => !excludedSpellNames.has(spell.name) && (spell.prepared === 'Always' || spell.prepared === 'Prepared'));
            setSpells(filtered);
        } else {
            const filtered = spells.filter(spell => !excludedSpellNames.has(spell.name));
            setSpells(filtered);
        }
        setFilterPrepared(!filterPrepared)
    }
    const handleSortLevel = () => {
        const spells = cloneDeep(playerStats.spellAbilities.spells);
        // Sort by level (ascending) then by name
        spells.sort((a, b) => {
            if (a.level !== b.level) {
                return a.level - b.level;
            } else {
                return a.name.localeCompare(b.name);
              }
          });
        setSpells(spells);
    }
    const handleSortSpell = () => {
        const spells = cloneDeep(playerStats.spellAbilities.spells);
        spells.sort((a, b) => a.name.localeCompare(b.name));
        setSpells(spells);
    }
return (
        <div className="char-spells">
            {(playerStats.spellAbilities) && <div className="spell-popup-parent">
                    <SpellTargetPopups
                        playerStats={playerStats}
                        campaignName={campaignName}
                        selectedSpell={selectedSpell}
                        setSelectedSpell={setSelectedSpell}
                        pendingUpcast={pendingUpcast}
                        buildUpcastLevels={buildUpcastLevels}
                        handleUpcastConfirm={handleUpcastConfirm}
                        handleUpcastCancel={handleUpcastCancel}
                        pendingMetamagic={pendingMetamagic}
                        handleConfirm={handleConfirm}
                        handleSkip={handleSkip}
                        pendingMultiTarget={pendingMultiTarget}
                        handleMultiTargetConfirm={handleMultiTargetConfirm}
                        handleMultiTargetSkip={handleMultiTargetSkip}
                        pendingMagicMissile={pendingMagicMissile}
                        handleMagicMissileConfirm={handleMagicMissileConfirm}
                        handleMagicMissileSkip={handleMagicMissileSkip}
                        wordsOfCreationTarget={wordsOfCreationTarget}
                        handleSpellCast={handleSpellCast}
                    />
                    <CreatureTargetPopups
                        playerStats={playerStats}
                        campaignName={campaignName}
                        flowHoldMonster={flowHoldMonster}
                        handleHoldMonsterConfirm={handleHoldMonsterConfirm}
                        handleHoldMonsterSkip={handleHoldMonsterSkip}
                        flowHoldPerson={flowHoldPerson}
                        handleHoldPersonConfirm={handleHoldPersonConfirm}
                        handleHoldPersonSkip={handleHoldPersonSkip}
                        flowPolymorph={flowPolymorph}
                        handlePolymorphConfirm={handlePolymorphConfirm}
                        handlePolymorphSkip={handlePolymorphSkip}
                        pendingShapechange={pendingShapechange}
                        flowAnimalShapes={flowAnimalShapes}
                        handleAnimalShapesTargetConfirm={handleAnimalShapesTargetConfirm}
                        handleAnimalShapesSkip={handleAnimalShapesSkip}
                        flowTruePolymorph={flowTruePolymorph}
                        handleTruePolymorphPathSelect={handleTruePolymorphPathSelect}
                        handleTruePolymorphSkip={handleTruePolymorphSkip}
                        handleTruePolymorphTargetConfirm={handleTruePolymorphTargetConfirm}
                        flowCharmPerson={flowCharmPerson}
                        handleCharmPersonConfirm={handleCharmPersonConfirm}
                        handleCharmPersonSkip={handleCharmPersonSkip}
                        flowCharmMonster={flowCharmMonster}
                        handleCharmMonsterConfirm={handleCharmMonsterConfirm}
                        handleCharmMonsterSkip={handleCharmMonsterSkip}
                        flowBanishment={flowBanishment}
                        handleBanishmentConfirm={handleBanishmentConfirm}
                        handleBanishmentSkip={handleBanishmentSkip}
                        flowPrismaticSpray={flowPrismaticSpray}
                        handlePrismaticSprayConfirm={handlePrismaticSprayConfirm}
                        handlePrismaticSpraySkip={handlePrismaticSpraySkip}
                        pendingHeroesFeast={pendingHeroesFeast}
                        handleHeroesFeastConfirm={handleHeroesFeastConfirm}
                        handleHeroesFeastSkip={handleHeroesFeastSkip}
                        pendingBane={pendingBane}
                        handleBaneConfirm={handleBaneConfirm}
                        handleBaneSkip={handleBaneSkip}
                        pendingBless={pendingBless}
                        handleBlessConfirm={handleBlessConfirm}
                        handleBlessSkip={handleBlessSkip}
                        pendingFaerieFire={pendingFaerieFire}
                        handleFaerieFireConfirm={handleFaerieFireConfirm}
                        handleFaerieFireSkip={handleFaerieFireSkip}
                        pendingHolyAura={pendingHolyAura}
                        handleHolyAuraConfirm={handleHolyAuraConfirm}
                        handleHolyAuraSkip={handleHolyAuraSkip}
                        pendingBeaconOfHope={pendingBeaconOfHope}
                        handleBeaconOfHopeConfirm={handleBeaconOfHopeConfirm}
                        handleBeaconOfHopeSkip={handleBeaconOfHopeSkip}
                        pendingSlow={pendingSlow}
                        handleSlowConfirm={handleSlowConfirm}
                        handleSlowSkip={handleSlowSkip}
                        pendingPassWithoutTrace={pendingPassWithoutTrace}
                        handlePassWithoutTraceConfirm={handlePassWithoutTraceConfirm}
                        handlePassWithoutTraceSkip={handlePassWithoutTraceSkip}
                        pendingGlobe={pendingGlobe}
                        handleGlobeConfirm={handleGlobeConfirm}
                        handleGlobeSkip={handleGlobeSkip}
                        pendingAntimagicField={pendingAntimagicField}
                        handleAntimagicFieldConfirm={handleAntimagicFieldConfirm}
                        handleAntimagicFieldSkip={handleAntimagicFieldSkip}
                        pendingForcecage={pendingForcecage}
                        handleForcecageConfirm={handleForcecageConfirm}
                        handleForcecageSkip={handleForcecageSkip}
                        pendingStinkingCloud={pendingStinkingCloud}
                        handleStinkingCloudConfirm={handleStinkingCloudConfirm}
                        handleStinkingCloudSkip={handleStinkingCloudSkip}
                        pendingConfusion={pendingConfusion}
                        handleConfusionConfirm={handleConfusionConfirm}
                        handleConfusionSkip={handleConfusionSkip}
                        pendingWeb={pendingWeb}
                        handleWebConfirm={handleWebConfirm}
                        handleWebSkip={handleWebSkip}
                        pendingAnimalFriendship={pendingAnimalFriendship}
                        handleAnimalFriendshipConfirm={handleAnimalFriendshipConfirm}
                        handleAnimalFriendshipSkip={handleAnimalFriendshipSkip}
                        pendingAuraOfLife={pendingAuraOfLife}
                        handleAuraOfLifeConfirm={handleAuraOfLifeConfirm}
                        handleAuraOfLifeSkip={handleAuraOfLifeSkip}
                        pendingAuraOfPurity={pendingAuraOfPurity}
                        handleAuraOfPurityConfirm={handleAuraOfPurityConfirm}
                        handleAuraOfPuritySkip={handleAuraOfPuritySkip}
                        pendingCircleOfPower={pendingCircleOfPower}
                        handleCircleOfPowerConfirm={handleCircleOfPowerConfirm}
                        handleCircleOfPowerSkip={handleCircleOfPowerSkip}
                        pendingCompulsion={pendingCompulsion}
                        handleCompulsionConfirm={handleCompulsionConfirm}
                        handleCompulsionSkip={handleCompulsionSkip}
                        pendingSleetStorm={pendingSleetStorm}
                        handleSleetStormConfirm={handleSleetStormConfirm}
                        handleSleetStormSkip={handleSleetStormSkip}
                    />
                    <TargetSpellPopups
                        playerStats={playerStats}
                        campaignName={campaignName}
                        pendingAuraOfVitality={pendingAuraOfVitality}
                        handleAuraOfVitalityConfirm={handleAuraOfVitalityConfirm}
                        handleAuraOfVitalitySkip={handleAuraOfVitalitySkip}
                        pendingForesight={pendingForesight}
                        handleForesightConfirm={handleForesightConfirm}
                        handleForesightSkip={handleForesightSkip}
                        pendingProtectionFromEvilAndGood={pendingProtectionFromEvilAndGood}
                        handleProtectionFromEvilAndGoodConfirm={handleProtectionFromEvilAndGoodConfirm}
                        handleProtectionFromEvilAndGoodSkip={handleProtectionFromEvilAndGoodSkip}
                        pendingProtectionFromPoison={pendingProtectionFromPoison}
                        handleProtectionFromPoisonConfirm={handleProtectionFromPoisonConfirm}
                        handleProtectionFromPoisonSkip={handleProtectionFromPoisonSkip}
                        pendingStoneSkin={pendingStoneSkin}
                        handleStoneSkinConfirm={handleStoneSkinConfirm}
                        handleStoneSkinSkip={handleStoneSkinSkip}
                        pendingLongstrider={pendingLongstrider}
                        handleLongstriderConfirm={handleLongstriderConfirm}
                        handleLongstriderSkip={handleLongstriderSkip}
                        pendingSpareTheDying={pendingSpareTheDying}
                        handleSpareTheDyingConfirm={handleSpareTheDyingConfirm}
                        handleSpareTheDyingSkip={handleSpareTheDyingSkip}
                        pendingDeathWard={pendingDeathWard}
                        handleDeathWardConfirm={handleDeathWardConfirm}
                        handleDeathWardSkip={handleDeathWardSkip}
                        pendingHeroism={pendingHeroism}
                        handleHeroismConfirm={handleHeroismConfirm}
                        handleHeroismSkip={handleHeroismSkip}
                        pendingHex={pendingHex}
                        handleHexConfirm={handleHexConfirm}
                        handleHexSkip={handleHexSkip}
                        pendingHaste={pendingHaste}
                        handleHasteConfirm={handleHasteConfirm}
                        handleHasteSkip={handleHasteSkip}
                        pendingEnhanceAbility={pendingEnhanceAbility}
                        enhanceAbilityStage={enhanceAbilityStage}
                        handleEnhanceAbilityAbilitySelect={handleEnhanceAbilityAbilitySelect}
                        handleEnhanceAbilityConfirm={handleEnhanceAbilityConfirm}
                        handleEnhanceAbilitySkip={handleEnhanceAbilitySkip}
                        pendingBarkskin={pendingBarkskin}
                        handleBarkskinConfirm={handleBarkskinConfirm}
                        handleBarkskinSkip={handleBarkskinSkip}
                        pendingInvisibility={pendingInvisibility}
                        handleInvisibilityConfirm={handleInvisibilityConfirm}
                        handleInvisibilitySkip={handleInvisibilitySkip}
                        pendingGreaterInvisibility={pendingGreaterInvisibility}
                        handleGreaterInvisibilityConfirm={handleGreaterInvisibilityConfirm}
                        handleGreaterInvisibilitySkip={handleGreaterInvisibilitySkip}
                        pendingSanctuary={pendingSanctuary}
                        handleSanctuaryConfirm={handleSanctuaryConfirm}
                        handleSanctuarySkip={handleSanctuarySkip}
                        pendingFeignDeath={pendingFeignDeath}
                        handleFeignDeathConfirm={handleFeignDeathConfirm}
                        handleFeignDeathSkip={handleFeignDeathSkip}
                        pendingHeal={pendingHeal}
                        handleHealConfirm={handleHealConfirm}
                        handleHealSkip={handleHealSkip}
                        pendingRegenerate={pendingRegenerate}
                        handleRegenerateConfirm={handleRegenerateConfirm}
                        handleRegenerateSkip={handleRegenerateSkip}
                        pendingHealingWord={pendingHealingWord}
                        handleHealingWordConfirm={handleHealingWordConfirm}
                        handleHealingWordSkip={handleHealingWordSkip}
                        pendingCureWounds={pendingCureWounds}
                        handleCureWoundsConfirm={handleCureWoundsConfirm}
                        handleCureWoundsSkip={handleCureWoundsSkip}
                        pendingRevivify={pendingRevivify}
                        handleRevivifyConfirm={handleRevivifyConfirm}
                        handleRevivifySkip={handleRevivifySkip}
                        pendingGreaterRestoration={pendingGreaterRestoration}
                        handleGreaterRestorationConfirm={handleGreaterRestorationConfirm}
                        handleGreaterRestorationSkip={handleGreaterRestorationSkip}
                        handleGreaterRestorationNoEffects={handleGreaterRestorationNoEffects}
                        pendingGreaterRestorationTarget={pendingGreaterRestorationTarget}
                        setPendingGreaterRestorationTarget={setPendingGreaterRestorationTarget}
                        pendingLesserRestoration={pendingLesserRestoration}
                        handleLesserRestorationConfirm={handleLesserRestorationConfirm}
                        handleLesserRestorationSkip={handleLesserRestorationSkip}
                        pendingLesserRestorationTarget={pendingLesserRestorationTarget}
                        setPendingLesserRestorationTarget={setPendingLesserRestorationTarget}
                        pendingRemoveCurse={pendingRemoveCurse}
                        handleRemoveCurseConfirm={handleRemoveCurseConfirm}
                        handleRemoveCurseSkip={handleRemoveCurseSkip}
                        pendingMageArmor={pendingMageArmor}
                        handleMageArmorConfirm={handleMageArmorConfirm}
                        handleMageArmorSkip={handleMageArmorSkip}
                        pendingProtectionFromEnergy={pendingProtectionFromEnergy}
                        protectionFromEnergyStage={protectionFromEnergyStage}
                        handleProtectionFromEnergyTargetSelect={handleProtectionFromEnergyTargetSelect}
                        handleProtectionFromEnergyTypeSelect={handleProtectionFromEnergyTypeSelect}
                        handleProtectionFromEnergySkip={handleProtectionFromEnergySkip}
                        pendingResistance={pendingResistance}
                        resistanceStage={resistanceStage}
                        handleResistanceTargetSelect={handleResistanceTargetSelect}
                        handleResistanceTypeSelect={handleResistanceTypeSelect}
                        handleResistanceSkip={handleResistanceSkip}
                    />
            <br />
            <div className='spell-abilities'>
                {/*
                 * CHAR SPELLS — The remaining spells after Action, Bonus Action, and Reaction spells
                 * have been placed in their respective sections. These are primarily non-damage,
                 * non-healing spells (utility, ritual, etc.) that don't fit elsewhere.
                 *
                 * A spell exists in EXACTLY ONE section on the character sheet. No duplicates.
                 * Action spells with damage/healing → CharActions
                 * Bonus action spells → CharBonusActions
                 * Reaction spells → CharReactions
                 * Everything else → CharSpells (including non-damage/non-healing action spells)
                 *
                 * HANDLERS: Standard spell slot casting via useSpellCastExecutor / useSpellMetamagicFlow.
                 * Spells with special target selection (e.g. Aid, Heroes' Feast) are gated in the hook
                 * and shown via popups.
                 */}
                <div className="sectionHeader"><h4>&nbsp;Spells</h4></div>
                <div>
                    <b className={'clickable' + (cannotAct ? ' disabled-attack' : '') + (exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? ' stat--penalized' : '')} onClick={() => {
                      if (cannotAct) return;
                      rollAttack('Spell Attack', playerStats.spellAbilities.toHit - exhaustionPenalty, { forcedMode: conditionAttackMode !== 'normal' ? conditionAttackMode : (isSorcerer && innateSorceryActive ? 'advantage' : undefined) });
                    }}>Attack (to hit):</b> <span className={exhaustionPenalty > 0 || conditionAttackMode === 'disadvantage' || cannotAct ? 'stat--penalized' : ''}>+{playerStats.spellAbilities.toHit - exhaustionPenalty}</span><br/>
                    <b>Modifier:</b> <span className={exhaustionPenalty > 0 ? 'stat--penalized' : ''}>+{playerStats.spellAbilities.modifier - exhaustionPenalty}</span><br/>
                      <b>Save DC:</b> {playerStats.spellAbilities.saveDc + (innateSorceryActive ? 1 : 0)}
                </div>
                <div>
                    <b>Cantrips Known:</b> {playerStats.spellAbilities.cantrips_known ? playerStats.spellAbilities.cantrips_known : 0}<br/>
                    {showPreparedColumn && <div>
                        <b>Prepared Spells:</b> {playerStats.spellAbilities.prepared_spells || playerStats.spellAbilities.spells_known ? (playerStats.spellAbilities.prepared_spells || playerStats.spellAbilities.spells_known) : 'All'}<br/>                    
                        <b>Max Prepared:</b> {playerStats.spellAbilities.maxPreparedSpells ? playerStats.spellAbilities.maxPreparedSpells : 'All'}
                    </div>}
                </div>
                <CharSpellSlots playerStats={playerStats} campaignName={campaignName}></CharSpellSlots>
            </div>
            {spells.length > 0 && <table className='table-spells table-striped'>
                <thead>
                    <tr>
                        <th className='left clickable' onClick={handleSortSpell}>Spell</th>
                        <th className='clickable' onClick={handleSortLevel}>Level</th>
                        {showPreparedColumn && <th className='clickable' onClick={handleTogglePreparedFilter}>Prepared</th>}
                        <th>Time</th>
                        <th>Range</th>
                        <th>Effect</th>
                        <th>Duration</th>
                        <th className='left'>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    {spells.map((spell) => {
                        const notes = spell.components ? [spell.components.join('/')] : [];
                        const effect = computeSpellEffectLabel(spell, playerStats);
                        const isPrepared = spell.prepared === 'Always' || spell.prepared === 'Prepared';
                        // 2024 wizards: unprepared non-ritual spells are in the spellbook but not castable;
                        // unprepared rituals remain castable via Ritual Adept. Other classes always have
                        // prepared spells, so nothing is ever grayed.
                        const isGrayedNonCastable = is2024 && isWizard && !isPrepared && !spell.ritual;
                        return <tr key={spell.name} className={isGrayedNonCastable ? 'spell-row-not-castable' : ''}>
                            <td className={`left spell-name ${isGrayedNonCastable ? 'not-castable' : 'clickable'}`} title={isGrayedNonCastable ? 'Not prepared' : undefined} onClick={() => { if (!isGrayedNonCastable) setSelectedSpell(spell); }}>{spell.name}</td>
                            <td>{spell.level === 0 ? 'Cantrip' : spell.level}</td>
                            {showPreparedColumn && <SpellPreparedCell spell={spell} handleTogglePreparedSpells={handleTogglePreparedSpells} />}
                            <td>{formatSpellCastingTime(playerStats, spell)}</td>
                            <td>{spell.range}</td>
                            <td>{effect}</td>
                            <td>{formatSpellDuration(spell)}</td>
                            <td className='left'>{notes.join(', ').replace('Concentration','Con')}</td>
                        </tr>;
                    })}
                </tbody>
            </table>}
        </div>}
    </div>
    )
};

export default CharSpells
