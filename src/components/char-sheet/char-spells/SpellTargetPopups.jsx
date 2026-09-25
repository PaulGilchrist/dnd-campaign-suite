import React from 'react';
import Popup from '../../common/popup.jsx';
import MetamagicPopup from '../popups/MetamagicPopup.jsx';
import SpellDetailPopup from './SpellDetailPopup.jsx';
import MultiTargetPopup from '../popups/MultiTargetPopup.jsx';
import SecondaryTargetModal from '../modals/shared/SecondaryTargetModal.jsx';
import MagicMissileTargetPopup from '../popups/MagicMissileTargetPopup.jsx';
import { getTargetFromAttacker } from '../../../services/rules/combat/damageUtils.js';
import { rangeToFeet } from '../../../services/rules/combat/rangeValidation.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import UpcastPopup from './UpcastPopup.jsx';

const SpellTargetPopups = function SpellTargetPopups({
    playerStats,
    campaignName,
    selectedSpell,
    setSelectedSpell,
    pendingUpcast,
    buildUpcastLevels,
    handleUpcastConfirm,
    handleUpcastCancel,
    pendingMetamagic,
    handleConfirm,
    handleSkip,
    pendingMultiTarget,
    handleMultiTargetConfirm,
    handleMultiTargetSkip,
    pendingMagicMissile,
    handleMagicMissileConfirm,
    handleMagicMissileSkip,
    wordsOfCreationTarget,
    handleSpellCast,
}) {
    return (
        <>
            {(playerStats.spellAbilities.spells.length > 0) && selectedSpell && (
                <Popup onClickOrKeyDown={() => setSelectedSpell(null)} showCloseButton={false}>
                    <SpellDetailPopup
                        spell={selectedSpell}
                        playerStats={playerStats}
                        campaignName={campaignName}
                        playerLevel={playerStats.level}
                        upcastLevels={buildUpcastLevels(selectedSpell)}
                        onClose={() => setSelectedSpell(null)}
                        onCast={(spell, metaCtx) => {
                            // SINGLE ENTRY POINT: Every spell cast MUST go through handleSpellCast → gateMetamagic.
                            // gateMetamagic is the only function that calls prepareSpellCast (spells slots, concentration, free casts).
                            // NEVER call prepareSpellCast, castAction, or executeSpellCast directly from JSX onClick handlers.
                            setSelectedSpell(null);
                            handleSpellCast(spell, metaCtx);
                        }}
                    />
                </Popup>
            )}
            {pendingUpcast && (
                <UpcastPopup
                    spell={pendingUpcast.spell}
                    levels={buildUpcastLevels(pendingUpcast.spell)}
                    onConfirm={handleUpcastConfirm}
                    onCancel={handleUpcastCancel}
                />
            )}
            {pendingMetamagic && (
                <MetamagicPopup
                    spell={{ name: pendingMetamagic.spellName, level: pendingMetamagic.spellLevel || 0 }}
                    playerStats={{ ...playerStats, _metamagicCurrentSP: pendingMetamagic._currentSP, _isPsionicSpell: pendingMetamagic.isPsionic, _psionicCost: pendingMetamagic.psionicCost }}
                    campaignName={campaignName}
                    onConfirm={handleConfirm}
                    onSkip={handleSkip}
                />
            )}
            {pendingMagicMissile && (() => {
                const { spell, totalMissiles, missileDamage, creatureTargets } = pendingMagicMissile;
                const currentTargetName = getTargetFromAttacker(getCombatSummary(campaignName), playerStats.name)?.name;
                return (
                    <MagicMissileTargetPopup
                        spell={{ name: spell.name, level: spell.level || 0 }}
                        playerStats={playerStats}
                        campaignName={campaignName}
                        totalMissiles={totalMissiles}
                        missileDamage={missileDamage}
                        creatureTargets={creatureTargets}
                        currentTargetName={currentTargetName}
                        onConfirm={handleMagicMissileConfirm}
                        onSkip={handleMagicMissileSkip}
                    />
                );
            })()}
            {pendingMultiTarget && (
                <MultiTargetPopup
                    spell={{ name: pendingMultiTarget.spellName, level: pendingMultiTarget.spellLevel || 0 }}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    range={pendingMultiTarget.range}
                    creatureTargets={pendingMultiTarget.creatureTargets}
                    onConfirm={handleMultiTargetConfirm}
                    onSkip={handleMultiTargetSkip}
                />
            )}
            {wordsOfCreationTarget && (
                <SecondaryTargetModal
                    title={wordsOfCreationTarget.title}
                    targets={wordsOfCreationTarget.targets}
                    onTargetSelected={wordsOfCreationTarget.onTargetSelected}
                    onSkip={wordsOfCreationTarget.onSkip}
                    featureDescription={wordsOfCreationTarget.featureDescription}
                    description={wordsOfCreationTarget.description}
                    confirmLabel={wordsOfCreationTarget.confirmLabel}
                    confirmIcon={wordsOfCreationTarget.confirmIcon}
                    campaignName={campaignName}
                    attackerName={playerStats.name}
                    rangeFt={wordsOfCreationTarget.range ? rangeToFeet(wordsOfCreationTarget.range) : null}
                />
            )}
        </>
    );
};

export default SpellTargetPopups;
