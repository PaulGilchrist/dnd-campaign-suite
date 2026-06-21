import HealingPoolModal from './modals/divine/HealingPoolModal.jsx'
import HandOfHealingModal from './modals/shared/HandOfHealingModal.jsx'
import FontOfMagicModal from './modals/FontOfMagicModal.jsx'
import ResourcePoolModal from './modals/ResourcePoolModal.jsx'
import WildCompanionModal from './modals/WildCompanionModal.jsx'
import SetConditionModal from './modals/shared/SetConditionModal.jsx'
import EyebiteEffectModal from './modals/EyebiteEffectModal.jsx'
import AttackRiderModal from './modals/shared/AttackRiderModal.jsx'
import OpenHandTechniqueModal from './modals/OpenHandTechniqueModal.jsx'
import WeaponMasteryModal from './modals/WeaponMasteryModal.jsx'
import WeaponMasteryChoiceModal from './modals/WeaponMasteryChoiceModal.jsx'
import BastionOfLawModal from './modals/divine/BastionOfLawModal.jsx'
import CombatStanceModal from './modals/shared/CombatStanceModal.jsx'
import TeleportModal from './modals/TeleportModal.jsx'
import HealingIllusionModal from './modals/shared/HealingIllusionModal.jsx'
import SaveAttackHealModal from './modals/shared/SaveAttackHealModal.jsx'
import DivineSparkModal from './modals/divine/DivineSparkModal.jsx'
import DivineInterventionModal from './modals/divine/DivineInterventionModal.jsx'
import ArcaneChargeModal from './modals/arcane/ArcaneChargeModal.jsx'
import WarMagicCantripModal from './modals/WarMagicCantripModal.jsx'
import WarMagicSpellModal from './modals/WarMagicSpellModal.jsx'
import SacredWeaponModal from './modals/divine/SacredWeaponModal.jsx'
import ElderChampionRestoreModal from './modals/ElderChampionRestoreModal.jsx'
import PrimalCompanionBonusActionModal from './modals/PrimalCompanionBonusActionModal.jsx'
import MistyWandererModal from './modals/MistyWandererModal.jsx'
import BonusActionChoiceModal from './modals/shared/BonusActionChoiceModal.jsx'
import RevelationInFleshModal from './modals/RevelationInFleshModal.jsx'
import ElementalAffinityModal from './modals/ElementalAffinityModal.jsx'
import FiendishResilienceModal from './modals/FiendishResilienceModal.jsx'
import BoonOfEnergyResistanceModal from './modals/racial/BoonOfEnergyResistanceModal.jsx'
import DragonCompanionModal from './modals/DragonCompanionModal.jsx'
import WildMagicDoubleRollModal from './modals/WildMagicDoubleRollModal.jsx'
import WildMagicTamedModal from './modals/WildMagicTamedModal.jsx'
import ThirdEyeModal from './modals/arcane/ThirdEyeModal.jsx'
import SoulstitchSpellsModal from './modals/arcane/SoulstitchSpellsModal.jsx'
import IllusoryRealityModal from './modals/arcane/IllusoryRealityModal.jsx'
import CelestialRevelationModal from './modals/CelestialRevelationModal.jsx'
import ElfisLineageModal from './modals/racial/ElfisLineageModal.jsx'
import GnomishLineageModal from './modals/racial/GnomishLineageModal.jsx'
import FiendishLegacyModal from './modals/FiendishLegacyModal.jsx'
import GiantAncestryModal from './modals/racial/GiantAncestryModal.jsx'
import BreathWeaponShapeModal from './modals/racial/BreathWeaponShapeModal.jsx'
import HypnoticPatternShakeModal from './modals/shared/HypnoticPatternShakeModal.jsx'
import MoonlightStepResourceModal from './modals/MoonlightStepResourceModal.jsx'
import ConstellationSelectionModal from './modals/ConstellationSelectionModal.jsx'
import { handleClearWard, handleSpendDice, handleApply } from '../../services/automation/handlers/class-cleric-paladin/bastionOfLawHandler.js'

export default function CharActionModals({
    playerStats,
    campaignName,
    characters,
    healingPoolModal, setHealingPoolModal,
    handOfHealingModal, setHandOfHealingModal,
    fontOfMagicModal, setFontOfMagicModal,
    resourcePoolModal, setResourcePoolModal,
    wildCompanionModal, setWildCompanionModal,
    setConditionModal, setSetConditionModal,
    attackRiderModal, setAttackRiderModal,
    openHandTechniqueModal, setOpenHandTechniqueModal,
    weaponMasteryModal,
    weaponMasteryChoiceModal, setWeaponMasteryChoiceModal,
    combatStanceModal, setCombatStanceModal,
    teleportModal, setTeleportModal,
    healingIllusionModal, setHealingIllusionModal,
    saveAttackHealModal, setSaveAttackHealModal,
    divineSparkModal, setDivineSparkModal,
    divineInterventionModal, setDivineInterventionModal,
    setDivineInterventionAction,
    moonlightStepResourceModal, setMoonlightStepResourceModal,
    starryFormConstellationModal, setStarryFormConstellationModal,
    twinklingConstellationModal, setTwinklingConstellationModal,
    arcaneChargeModal, setArcaneChargeModal,
    warMagicCantripModal, setWarMagicCantripModal,
    warMagicSpellModal, setWarMagicSpellModal,
    sacredWeaponModal, setSacredWeaponModal,
    elderChampionRestoreModal, setElderChampionRestoreModal,
    primalCompanionBonusActionModal, setPrimalCompanionBonusActionModal,
    mistyWandererModal, setMistyWandererModal,
    bonusActionChoiceModal, setBonusActionChoiceModal,
    revelationInFleshModal, setRevelationInFleshModal,
    bastionOfLawModal, setBastionOfLawModal,
    elementalAffinityModal, setElementalAffinityModal,
    fiendishResilienceModal, setFiendishResilienceModal,
    boonOfEnergyResistanceModal, setBoonOfEnergyResistanceModal,
    dragonCompanionModal, setDragonCompanionModal,
    wildMagicDoubleRollModal, setWildMagicDoubleRollModal,
    wildMagicTamedModal, setWildMagicTamedModal,
    thirdEyeModal, setThirdEyeModal,
    soulstitchSpellsModal, setSoulstitchSpellsModal,
    illusoryRealityModal, setIllusoryRealityModal,
    celestialRevelationModal, setCelestialRevelationModal,
    elfishLineageModal, setElfisLineageModal,
    gnomishLineageModal, setGnomishLineageModal,
    fiendishLegacyModal, setFiendishLegacyModal,
    giantAncestryModal, setGiantAncestryModal,
    eyebiteEffectModal, setEyebiteEffectModal,
    breathWeaponShapeModal, setBreathWeaponShapeModal,
    hypnoticPatternShakeModal, setHypnoticPatternShakeModal,
    divineFuryChoice,
    damageTypeChoice,
    featureChoice,
    cleaveAttackPending,
    handleMasteryClose,
    handleWeaponMasteryChoice,
    handleCleaveAttack,
    handleCleaveSkip,
    handleDivineFuryDamageType,
    handleDivineFurySkip,
    handleGenericDamageTypeChoice,
    handleGenericDamageTypeSkip,
    handleDamageTypeModifierChoice,
    handleDamageTypeModifierSkip,
    handleEnhancedUnarmedChoice,
    handleEnhancedUnarmedSkip,
    handleFeatureChoiceConfirm,
    handleFeatureChoiceSkip,
    handleConstellationSelect,
    handleElderChampionRestore,
    handleDivineInterventionCast,
    pendingDamageRef,
}) {
    return (
        <>
            {healingPoolModal && (
                <HealingPoolModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    name={healingPoolModal.name}
                    poolMax={healingPoolModal.pool}
                    poolExpression={healingPoolModal.poolExpression}
                    isDicePool={healingPoolModal.isDicePool}
                    dieType={healingPoolModal.dieType}
                    resourceKey={healingPoolModal.resourceKey}
                    alsoCures={healingPoolModal.alsoCures}
                    cureCost={healingPoolModal.cureCost}
                    bloodiedOnly={healingPoolModal.bloodiedOnly}
                    restoringTouchConditions={healingPoolModal.restoringTouchConditions}
                    maxDicePerUse={healingPoolModal.maxDicePerUse}
                    onClose={() => setHealingPoolModal(null)}
                />
            )}
            {handOfHealingModal && (
                <HandOfHealingModal
                    {...handOfHealingModal}
                    campaignName={campaignName}
                    onClose={() => setHandOfHealingModal(null)}
                />
            )}
            {fontOfMagicModal && (
                <FontOfMagicModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setFontOfMagicModal(null)}
                />
            )}
            {resourcePoolModal && (
                <ResourcePoolModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    automation={resourcePoolModal.automation}
                    onClose={() => setResourcePoolModal(null)}
                />
            )}
            {moonlightStepResourceModal && (
                <MoonlightStepResourceModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    automation={moonlightStepResourceModal.automation}
                    onClose={() => setMoonlightStepResourceModal(null)}
                />
            )}
            {wildCompanionModal && (
                <WildCompanionModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setWildCompanionModal(null)}
                />
            )}
            {setConditionModal && (
                <SetConditionModal
                    {...setConditionModal}
                    characters={characters}
                    onClose={() => setSetConditionModal(null)}
                />
            )}
            {eyebiteEffectModal && (
                <EyebiteEffectModal
                    {...eyebiteEffectModal}
                    characters={characters}
                    onClose={() => setEyebiteEffectModal(null)}
                />
            )}
            {attackRiderModal && (
                <AttackRiderModal
                    {...attackRiderModal}
                    onClose={() => { setAttackRiderModal(null); window.dispatchEvent(new CustomEvent('target-effects-updated')); }}
                />
            )}
            {openHandTechniqueModal && (
                <OpenHandTechniqueModal
                    {...openHandTechniqueModal}
                    onClose={() => { setOpenHandTechniqueModal(null); window.dispatchEvent(new CustomEvent('target-effects-updated')); window.dispatchEvent(new CustomEvent('combat-summary-updated')); }}
                />
            )}
            {weaponMasteryModal && (
                <WeaponMasteryModal
                    {...weaponMasteryModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    targetName={null}
                    onClose={handleMasteryClose}
                />
            )}
            {weaponMasteryChoiceModal && (
                <WeaponMasteryChoiceModal
                    {...weaponMasteryChoiceModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => { setWeaponMasteryChoiceModal(null); }}
                    onConfirm={handleWeaponMasteryChoice}
                />
            )}
            {cleaveAttackPending && (
                <div className="sp-overlay" onClick={handleCleaveSkip}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
                        <div className="sp-header">
                            <i className="fa-solid fa-crosshairs"></i> Cleave — Choose Second Target
                        </div>
                        <div className="sp-body">
                            <p>Choose a creature within 5 feet of the first target for the Cleave extra attack:</p>
                            <div style={{ textAlign: 'left', marginTop: '12px' }}>
                                {cleaveAttackPending.secondTargets.map((target, i) => {
                                    const hp = target.currentHp ?? target.maxHp;
                                    const maxHp = target.maxHp;
                                    const pct = maxHp > 0 ? Math.round((hp / maxHp) * 100) : 0;
                                    return (
                                        <label key={i} style={{
                                            display: 'block', padding: '8px 12px', margin: '4px 0',
                                            borderRadius: '6px', cursor: 'pointer',
                                            background: 'transparent',
                                            border: '1px solid transparent',
                                        }} onClick={() => handleCleaveAttack(target.name)}>
                                            <strong>{target.name}</strong>
                                            <span style={{ marginLeft: '8px', opacity: 0.7 }}>
                                                {hp}/{maxHp} HP ({pct}%)
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                            <p style={{ opacity: 0.7, fontSize: '0.85em', marginTop: '8px' }}>
                                On a hit, the second creature takes weapon damage (no ability modifier to damage unless negative). Once per turn.
                            </p>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-dismiss-btn" onClick={handleCleaveSkip}>Skip</button>
                        </div>
                    </div>
                </div>
            )}
            {combatStanceModal && (
                <CombatStanceModal
                    {...combatStanceModal}
                    onClose={() => { setCombatStanceModal(null); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                />
            )}
            {revelationInFleshModal && (
                <RevelationInFleshModal
                    {...revelationInFleshModal}
                    onClose={() => { setRevelationInFleshModal(null); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                />
            )}
            {bastionOfLawModal && (
                <BastionOfLawModal
                    {...bastionOfLawModal}
                    campaignName={campaignName}
                    onConfirm={async (spAmount, targetName, diceToSpend, clearWard) => {
                        if (clearWard) {
                            const action = { name: bastionOfLawModal.featureName, automation: bastionOfLawModal.auto };
                            return await handleClearWard(action, playerStats, campaignName);
                        }
                        if (diceToSpend !== undefined && diceToSpend !== null) {
                            const action = { name: bastionOfLawModal.featureName, automation: bastionOfLawModal.auto };
                            return await handleSpendDice(action, playerStats, campaignName, diceToSpend);
                        }
                        const action = { name: bastionOfLawModal.featureName, automation: bastionOfLawModal.auto };
                        return await handleApply(action, playerStats, campaignName, spAmount, targetName);
                    }}
                    onClose={() => setBastionOfLawModal(null)}
                />
            )}
            {teleportModal && (
                <TeleportModal
                    {...teleportModal}
                    onClose={() => { setTeleportModal(null); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                />
            )}
            {healingIllusionModal && (
                <HealingIllusionModal
                    {...healingIllusionModal}
                    onClose={() => { setHealingIllusionModal(null); window.dispatchEvent(new CustomEvent('buffs-updated')); }}
                />
            )}
            {saveAttackHealModal && (
                <SaveAttackHealModal
                    {...saveAttackHealModal}
                    onClose={() => setSaveAttackHealModal(null)}
                />
            )}
            {divineSparkModal && (
                <DivineSparkModal
                    {...divineSparkModal}
                    playerStats={playerStats}
                    onClose={() => setDivineSparkModal(null)}
                />
            )}
            {divineInterventionModal && (
                <DivineInterventionModal
                    {...divineInterventionModal}
                    onSelect={handleDivineInterventionCast}
                    onClose={() => {
                        setDivineInterventionModal(null);
                        setDivineInterventionAction(null);
                    }}
                />
            )}
            {arcaneChargeModal && (
                <ArcaneChargeModal
                    {...arcaneChargeModal}
                    onClose={() => setArcaneChargeModal(null)}
                />
            )}
            {warMagicCantripModal && (
                <WarMagicCantripModal
                    {...warMagicCantripModal}
                    onClose={() => setWarMagicCantripModal(null)}
                />
            )}
            {warMagicSpellModal && (
                <WarMagicSpellModal
                    {...warMagicSpellModal}
                    onClose={() => setWarMagicSpellModal(null)}
                />
            )}
            {sacredWeaponModal && (
                <SacredWeaponModal
                    {...sacredWeaponModal}
                    onClose={() => setSacredWeaponModal(null)}
                />
            )}
            {elderChampionRestoreModal && (
                <ElderChampionRestoreModal
                    action={elderChampionRestoreModal.payload.action}
                    playerStats={elderChampionRestoreModal.payload.playerStats}
                    campaignName={elderChampionRestoreModal.payload.campaignName}
                    onConfirm={() => {
                        handleElderChampionRestore(elderChampionRestoreModal.payload);
                        setElderChampionRestoreModal(null);
                    }}
                    onClose={() => setElderChampionRestoreModal(null)}
                />
            )}
            {primalCompanionBonusActionModal && (
                <PrimalCompanionBonusActionModal
                    {...primalCompanionBonusActionModal}
                    onClose={() => setPrimalCompanionBonusActionModal(null)}
                />
            )}
            {mistyWandererModal && (
                <MistyWandererModal
                    {...mistyWandererModal}
                    onClose={() => setMistyWandererModal(null)}
                />
            )}
            {bonusActionChoiceModal && (
                <BonusActionChoiceModal
                    {...bonusActionChoiceModal}
                    onClose={() => setBonusActionChoiceModal(null)}
                />
            )}
            {bastionOfLawModal && (
                <BastionOfLawModal
                    {...bastionOfLawModal}
                    onClose={() => setBastionOfLawModal(null)}
                />
            )}
            {elementalAffinityModal && (
                <ElementalAffinityModal
                    {...elementalAffinityModal}
                    onClose={() => setElementalAffinityModal(null)}
                />
            )}
            {fiendishResilienceModal && (
                <FiendishResilienceModal
                    {...fiendishResilienceModal}
                    onClose={() => setFiendishResilienceModal(null)}
                />
            )}
            {boonOfEnergyResistanceModal && (
                <BoonOfEnergyResistanceModal
                    {...boonOfEnergyResistanceModal}
                    onClose={() => setBoonOfEnergyResistanceModal(null)}
                />
            )}
            {dragonCompanionModal && (
                <DragonCompanionModal
                    {...dragonCompanionModal}
                    onClose={() => setDragonCompanionModal(null)}
                />
            )}
            {wildMagicDoubleRollModal && (
                <WildMagicDoubleRollModal
                    {...wildMagicDoubleRollModal}
                    onClose={() => setWildMagicDoubleRollModal(null)}
                />
            )}
            {wildMagicTamedModal && (
                <WildMagicTamedModal
                    {...wildMagicTamedModal}
                    onClose={() => setWildMagicTamedModal(null)}
                />
            )}
            {thirdEyeModal && (
                <ThirdEyeModal
                    action={thirdEyeModal.action}
                    playerStats={thirdEyeModal.playerStats}
                    campaignName={thirdEyeModal.campaignName}
                    onClose={() => setThirdEyeModal(null)}
                />
            )}
            {soulstitchSpellsModal && (
                <SoulstitchSpellsModal
                    {...soulstitchSpellsModal}
                    onClose={() => setSoulstitchSpellsModal(null)}
                />
            )}
            {illusoryRealityModal && (
                <IllusoryRealityModal
                    {...illusoryRealityModal}
                    onClose={() => setIllusoryRealityModal(null)}
                />
            )}
            {celestialRevelationModal && (
                <CelestialRevelationModal
                    {...celestialRevelationModal}
                    onClose={() => setCelestialRevelationModal(null)}
                />
            )}
            {elfishLineageModal && (
                <ElfisLineageModal
                    {...elfishLineageModal}
                    onClose={() => setElfisLineageModal(null)}
                />
            )}
            {gnomishLineageModal && (
                <GnomishLineageModal
                    {...gnomishLineageModal}
                    onClose={() => setGnomishLineageModal(null)}
                />
            )}
            {fiendishLegacyModal && (
                <FiendishLegacyModal
                    {...fiendishLegacyModal}
                    onClose={() => setFiendishLegacyModal(null)}
                />
            )}
            {giantAncestryModal && (
                <GiantAncestryModal
                    {...giantAncestryModal}
                    onClose={() => setGiantAncestryModal(null)}
                />
            )}
            {breathWeaponShapeModal && (
                <BreathWeaponShapeModal
                    {...breathWeaponShapeModal}
                    onClose={() => setBreathWeaponShapeModal(null)}
                />
            )}
            {hypnoticPatternShakeModal && (
                <HypnoticPatternShakeModal
                    {...hypnoticPatternShakeModal}
                    onClose={() => setHypnoticPatternShakeModal(null)}
                />
            )}
            {divineFuryChoice && (
                <div className="sp-overlay" onClick={handleDivineFurySkip}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> Divine Fury — Damage Type
                        </div>
                        <div className="sp-body">
                            <p>Choose the damage type for this hit:</p>
                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                <button className="sp-roll-btn" style={{ marginRight: '12px' }} onClick={() => handleDivineFuryDamageType('Necrotic')}>
                                    <i className="fa-solid fa-skull"></i> Necrotic
                                </button>
                                <button className="sp-roll-btn" onClick={() => handleDivineFuryDamageType('Radiant')}>
                                    <i className="fa-solid fa-sun"></i> Radiant
                                </button>
                            </div>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-dismiss-btn" onClick={handleDivineFurySkip}>Skip</button>
                        </div>
                    </div>
                </div>
            )}
            {damageTypeChoice && (
                <div className="sp-overlay" onClick={() => {
                    if (pendingDamageRef.current?._attackRider) handleEnhancedUnarmedSkip();
                    else if (pendingDamageRef.current?._damageTypeModifier) handleDamageTypeModifierSkip();
                    else handleGenericDamageTypeSkip();
                }}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> {damageTypeChoice.title}
                        </div>
                        <div className="sp-body">
                            <p>Choose the damage type for this hit:</p>
                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                {damageTypeChoice.types.map((type) => (
                                    <button
                                        key={type}
                                        className="sp-roll-btn"
                                        style={{ margin: '0 6px 8px 6px' }}
                                        onClick={() => {
                                            if (pendingDamageRef.current?._attackRider) handleEnhancedUnarmedChoice(type);
                                            else if (pendingDamageRef.current?._damageTypeModifier) handleDamageTypeModifierChoice(type);
                                            else handleGenericDamageTypeChoice(type);
                                        }}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-dismiss-btn" onClick={() => {
                                if (pendingDamageRef.current?._attackRider) handleEnhancedUnarmedSkip();
                                else if (pendingDamageRef.current?._damageTypeModifier) handleDamageTypeModifierSkip();
                                else handleGenericDamageTypeSkip();
                            }}>Skip</button>
                        </div>
                    </div>
                </div>
            )}
            {featureChoice && (
                <div className="sp-overlay" onClick={handleFeatureChoiceSkip}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> {featureChoice.action.name}
                        </div>
                        <div className="sp-body">
                            <p><b>Choose your option:</b></p>
                            <p style={{ opacity: 0.8, fontSize: '0.9em' }}>{featureChoice.action.description}</p>
                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                {featureChoice.options.map((opt, i) => {
                                    const optName = typeof opt === 'string' ? opt : opt.name;
                                    return (
                                        <button
                                            key={optName || i}
                                            className="sp-roll-btn"
                                            style={{ margin: '0 6px 8px 6px' }}
                                            onClick={() => handleFeatureChoiceConfirm(optName)}
                                        >
                                            {optName}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-dismiss-btn" onClick={handleFeatureChoiceSkip}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
            {starryFormConstellationModal && (
                <ConstellationSelectionModal
                    action={starryFormConstellationModal.payload.action}
                    playerStats={starryFormConstellationModal.payload.playerStats}
                    campaignName={starryFormConstellationModal.payload.campaignName}
                    isTwinkled={false}
                    onConfirm={(option) => handleConstellationSelect(starryFormConstellationModal.payload, option)}
                    onClose={() => setStarryFormConstellationModal(null)}
                />
            )}
            {twinklingConstellationModal && (
                <ConstellationSelectionModal
                    action={twinklingConstellationModal.payload.action}
                    playerStats={twinklingConstellationModal.payload.playerStats}
                    campaignName={twinklingConstellationModal.payload.campaignName}
                    isTwinkled={true}
                    onConfirm={(option) => handleConstellationSelect(twinklingConstellationModal.payload, option)}
                    onClose={() => setTwinklingConstellationModal(null)}
                />
            )}
        </>
    )
}
