import React from 'react';
import MassHealModal from './MassHealModal.jsx';
import MassCureWoundsModal from './MassCureWoundsModal.jsx';
import PrayerOfHealingModal from './PrayerOfHealingModal.jsx';
import PowerWordFortifyModal from './PowerWordFortifyModal.jsx';
import MassHealingWordModal from './MassHealingWordModal.jsx';
import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';

function hasNoHealingModalOpen({
    massHealModal,
    clockworkCavalcadeHealModal,
    clockworkCavalcadeDispelModal,
    massCureWoundsModal,
    prayerOfHealingModal,
    powerWordFortifyModal,
    massHealingWordModal,
    naturesSanctuaryCreaturesModal,
}) {
    return [
        massHealModal,
        clockworkCavalcadeHealModal,
        clockworkCavalcadeDispelModal,
        massCureWoundsModal,
        prayerOfHealingModal,
        powerWordFortifyModal,
        massHealingWordModal,
        naturesSanctuaryCreaturesModal,
    ].every(m => !m);
}

export default function HealingModals({
    mergedModalState,
    setModalState,
    handleMassHealConfirm,
    handleClockworkCavalcadeHealConfirm,
    handleClockworkCavalcadeDispelConfirm,
    handleMassCureWoundsConfirm,
    handlePrayerOfHealingConfirm,
    handlePowerWordFortifyConfirm,
    handleMassHealingWordConfirm,
    handleNaturesSanctuaryConfirm,
}) {
    const {
        massHealModal,
        clockworkCavalcadeHealModal,
        clockworkCavalcadeDispelModal,
        massCureWoundsModal,
        prayerOfHealingModal,
        powerWordFortifyModal,
        massHealingWordModal,
        naturesSanctuaryCreaturesModal,
    } = mergedModalState;

    if (hasNoHealingModalOpen(mergedModalState)) {
        return null;
    }

    return (
        <>
            {massHealModal && (
                <MassHealModal
                    creatureTargets={massHealModal.creatureTargets}
                    maxTargets={massHealModal.maxTargets}
                    pool={massHealModal.totalPool}
                    onConfirm={handleMassHealConfirm}
                    onSkip={() => setModalState({ massHealModal: null })}
                    campaignName={massHealModal.campaignName}
                    combatSummary={massHealModal.combatSummary}
                />
            )}
            {clockworkCavalcadeHealModal && (
                <MassHealModal
                    creatureTargets={clockworkCavalcadeHealModal.creatureTargets}
                    maxTargets={clockworkCavalcadeHealModal.creatureTargets.length}
                    pool={clockworkCavalcadeHealModal.maxHeal}
                    onConfirm={handleClockworkCavalcadeHealConfirm}
                    onSkip={() => setModalState({ clockworkCavalcadeHealModal: null })}
                    campaignName={clockworkCavalcadeHealModal.campaignName}
                    combatSummary={clockworkCavalcadeHealModal.combatSummary}
                    title="Clockwork Cavalcade: Heal"
                    description="Choose any number of creatures in the Cube. Divide <b>100 HP</b> among them however you like."
                    icon="fa-heart"
                    confirmLabel="Heal"
                    confirmIcon="fa-heart"
                />
            )}
            {clockworkCavalcadeDispelModal && (
                <CreatureSelectionModal
                    title="Clockwork Cavalcade: Dispel"
                    description="Every spell of level 6 and lower ends on creatures and objects of your choice in the Cube."
                    targets={clockworkCavalcadeDispelModal.creatureTargets}
                    confirmLabel="Dispel"
                    confirmIcon="fa-wand-magic-sparkles"
                    icon="fa-wand-magic-sparkles"
                    onConfirm={handleClockworkCavalcadeDispelConfirm}
                    onSkip={() => setModalState({ clockworkCavalcadeDispelModal: null })}
                />
            )}
            {massCureWoundsModal && (
                <MassCureWoundsModal
                    creatureTargets={massCureWoundsModal.creatureTargets}
                    maxTargets={massCureWoundsModal.maxTargets}
                    onConfirm={handleMassCureWoundsConfirm}
                    onSkip={() => setModalState({ massCureWoundsModal: null })}
                />
            )}
            {prayerOfHealingModal && (
                <PrayerOfHealingModal
                    creatureTargets={prayerOfHealingModal.creatureTargets}
                    maxTargets={prayerOfHealingModal.maxTargets}
                    onConfirm={handlePrayerOfHealingConfirm}
                    onSkip={() => setModalState({ prayerOfHealingModal: null })}
                />
            )}
            {powerWordFortifyModal && (
                <PowerWordFortifyModal
                    creatureTargets={powerWordFortifyModal.creatureTargets}
                    totalTempHp={powerWordFortifyModal.totalTempHp}
                    onConfirm={handlePowerWordFortifyConfirm}
                    onSkip={() => setModalState({ powerWordFortifyModal: null })}
                />
            )}
            {massHealingWordModal && (
                <MassHealingWordModal
                    creatureTargets={massHealingWordModal.creatureTargets}
                    maxTargets={massHealingWordModal.maxTargets}
                    onConfirm={handleMassHealingWordConfirm}
                    onSkip={() => setModalState({ massHealingWordModal: null })}
                />
            )}
            {naturesSanctuaryCreaturesModal && (
                <CreatureSelectionModal
                    title={naturesSanctuaryCreaturesModal.isMove ? "Nature's Sanctuary (Move) — Choose Creatures" : "Nature's Sanctuary — Choose Creatures"}
                    icon="fa-tree"
                    targets={naturesSanctuaryCreaturesModal.creatureTargets}
                    description="Select creatures to include in the sanctuary. Creatures in the sanctuary gain Half Cover and resistance to your Nature's Ward damage type."
                    note={naturesSanctuaryCreaturesModal.isMove ? "Existing creatures are pre-selected. Toggle to add or remove creatures." : "Expend 1 Wild Shape use to create the sanctuary."}
                    confirmLabel={naturesSanctuaryCreaturesModal.isMove ? "Move Sanctuary" : "Create Sanctuary"}
                    confirmIcon="fa-tree"
                    defaultSelected={naturesSanctuaryCreaturesModal.defaultSelected}
                    onConfirm={handleNaturesSanctuaryConfirm}
                    onSkip={() => setModalState({ naturesSanctuaryCreaturesModal: null })}
                />
            )}
        </>
    );
}
