import { useCallback, useState } from 'react';
import { useSyncedState } from '../../hooks/runtime/useSyncedState.js';
import useAttackDamageResolution from './useAttackDamageResolution.js';
import useModalHandlers from './useModalHandlers.js';
import { useCombatSuperiorityModal } from '../../hooks/combat/useCombatSuperiorityModal.js';

export default function useCharActionModals({
    playerStats, campaignName, mapName,
    popupHtml, setPopupHtml, rollDamage, rollAttack, buildCtx, buildCtxSync,
}) {
    const [modalState, _setModalState] = useState({});
    const setModalState = useCallback((updates) => {
        if (!updates) {
            _setModalState({});
            return;
        }
        _setModalState(prev => ({ ...prev, ...updates }));
    }, [_setModalState]);

    const [pendingDamage, setPendingDamage] = useSyncedState(campaignName, 'pipeline-pause', null, campaignName);

    const { resolveAttackDamage, proceedWithDamage } = useAttackDamageResolution({
        playerStats, campaignName, mapName,
        popupHtml, setPopupHtml, rollDamage, buildCtx, buildCtxSync,
        setModalState, modalState,
        setPendingDamage,
    });

    const {
        combatSuperiorityModal,
        setCombatSuperiorityModal,
        handleCombatSuperiorityConfirm,
        handleCombatSuperiorityReopenSelection,
    } = useCombatSuperiorityModal(playerStats, campaignName, rollAttack, rollDamage, setPopupHtml);

    const {
        handleMasteryClose,
        handleWeaponMasteryChoice,
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
        handleFlurryOfBlowsConfirm,
        handleFlurryOfBlowsSkip,
        handleOpenHandFromFlurryConfirm,
        handleOpenHandFromFlurrySkip,
    } = useModalHandlers({
        playerStats, campaignName,
        rollDamage, proceedWithDamage,
        pendingDamage, setPendingDamage,
        setModalState, modalState,
        setPopupHtml,
    });

    return {
        modalState,
        setModalState,
        pendingDamage,
        setPendingDamage,
        buildCtx,
        buildCtxSync,
        combatSuperiorityModal,
        setCombatSuperiorityModal,
        handleCombatSuperiorityConfirm,
        handleCombatSuperiorityReopenSelection,
        resolveAttackDamage,
        handleMasteryClose,
        handleWeaponMasteryChoice,
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
        handleFlurryOfBlowsConfirm,
        handleFlurryOfBlowsSkip,
        handleOpenHandFromFlurryConfirm,
        handleOpenHandFromFlurrySkip,
    };
}
