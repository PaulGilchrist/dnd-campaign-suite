import { rollExpression } from '../../services/dice/diceRoller.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { applyConstellationOption } from '../../services/automation/handlers/class-sorcerer/starryFormHandler.js';
import { applyConstellationOption as twinklingApply } from '../../services/automation/handlers/class-sorcerer/twinklingConstellationHandler.js';

export default function useModalHandlers({
    playerStats, campaignName,
    _rollDamage, proceedWithDamage,
    pendingDamage, setPendingDamage,
    setModalState, modalState,
    setPopupHtml,
}) {
    const handleMasteryClose = async () => {
        setModalState({ weaponMasteryModal: null });
        if (pendingDamage) {
            const { attack, formula, total, rolls, modifier } = pendingDamage;
            proceedWithDamage(attack, formula, total, rolls, modifier);
            setPendingDamage(null);
        }
    };

    const handleWeaponMasteryChoice = (_masteryName) => {
        setModalState({ weaponMasteryChoiceModal: null });
    };

    const handleDivineFuryDamageType = (chosenType) => {
        const pending = pendingDamage;
        if (!pending) {
            setModalState({ divineFuryChoice: null });
            return;
        }
        const { attack, formula, total, rolls, modifier, bonusExpr, bonusTotal, bonusRolls } = pending;
        const newFormula = `${formula} + ${bonusExpr} [${chosenType}]`;
        const newTotal = total + bonusTotal;
        const newRolls = [...rolls, ...bonusRolls];
        const playerName = playerStats.name;
        const currentRound = getCurrentCombatRound();
        setRuntimeValue(playerName, '_divineFuryUsedRound', currentRound, campaignName);
        setModalState({ divineFuryChoice: null });
        setPendingDamage(null);
        proceedWithDamage(attack, newFormula, newTotal, newRolls, modifier);
    };

    const handleDivineFurySkip = () => {
        const pending = pendingDamage;
        if (!pending) {
            setModalState({ divineFuryChoice: null });
            return;
        }
        const { attack, formula, total, rolls, modifier } = pending;
        setModalState({ divineFuryChoice: null });
        setPendingDamage(null);
        proceedWithDamage(attack, formula, total, rolls, modifier);
    };

    const handleGenericDamageTypeChoice = (chosenType) => {
        const pending = pendingDamage;
        if (!pending) {
            setModalState({ damageTypeChoice: null });
            return;
        }
        const { attack, formula, total, rolls, modifier, bonusExpr, bonusTotal, bonusRolls, oncePerTurnKey } = pending;
        const newFormula = `${formula} + ${bonusExpr} [${chosenType}]`;
        const newTotal = total + bonusTotal;
        const newRolls = [...rolls, ...bonusRolls];
        if (oncePerTurnKey) {
            setRuntimeValue(playerStats.name, oncePerTurnKey, getCurrentCombatRound(), campaignName);
        }
        setModalState({ damageTypeChoice: null });
        setPendingDamage(null);
        proceedWithDamage(attack, newFormula, newTotal, newRolls, modifier);
    };

    const handleGenericDamageTypeSkip = () => {
        const pending = pendingDamage;
        if (!pending) {
            setModalState({ damageTypeChoice: null });
            return;
        }
        const { attack, formula, total, rolls, modifier } = pending;
        setModalState({ damageTypeChoice: null });
        setPendingDamage(null);
        proceedWithDamage(attack, formula, total, rolls, modifier);
    };

    const handleDamageTypeModifierChoice = (chosenType) => {
        const pending = pendingDamage;
        if (!pending) {
            setModalState({ damageTypeChoice: null });
            return;
        }
        const { attack, formula, total, rolls, modifier, _damageTypeModifier } = pending;
        if (_damageTypeModifier) {
            attack.damageType = chosenType;
            const usedKey = `_${_damageTypeModifier.name.replace(/\s+/g, '_')}_usedRound`;
            setRuntimeValue(playerStats.name, usedKey, getCurrentCombatRound(), campaignName);
        }
        setModalState({ damageTypeChoice: null });
        setPendingDamage(null);
        proceedWithDamage(attack, formula, total, rolls, modifier);
    };

    const handleDamageTypeModifierSkip = () => {
        const pending = pendingDamage;
        if (!pending) {
            setModalState({ damageTypeChoice: null });
            return;
        }
        const { attack, formula, total, rolls, modifier, _damageTypeModifier } = pending;
        if (_damageTypeModifier) {
            const usedKey = `_${_damageTypeModifier.name.replace(/\s+/g, '_')}_usedRound`;
            setRuntimeValue(playerStats.name, usedKey, getCurrentCombatRound(), campaignName);
        }
        setModalState({ damageTypeChoice: null });
        setPendingDamage(null);
        proceedWithDamage(attack, formula, total, rolls, modifier);
    };

    const handleEnhancedUnarmedChoice = (chosenOptionName) => {
        const pending = pendingDamage;
        if (!pending) {
            setModalState({ damageTypeChoice: null });
            return;
        }
        const { attack, formula, total, rolls, rider, _attackRider } = pending;
        if (_attackRider) {
            const chosenOption = _attackRider.options.find(o => o.name === chosenOptionName);
            if (chosenOption && chosenOption.effect === 'damage_bonus') {
                const riderResult = rollExpression(chosenOption.damageExpression);
                if (riderResult) {
                    const newFormula = `${formula} + ${chosenOption.damageExpression} [${chosenOption.damageType || 'same_as_weapon'}]`;
                    const newTotal = total + riderResult.total;
                    const newRolls = [...rolls, ...riderResult.rolls];
                    const usedKey = `_${_attackRider.name.replace(/\s+/g, '_')}_usedRound`;
                    setRuntimeValue(playerStats.name, usedKey, getCurrentCombatRound(), campaignName);
                    setModalState({ damageTypeChoice: null });
                    setPendingDamage(null);
                    proceedWithDamage(attack, newFormula, newTotal, newRolls, rider);
                    return;
                }
            }
        }
        setModalState({ damageTypeChoice: null });
        setPendingDamage(null);
        proceedWithDamage(attack, formula, total, rolls, rider);
    };

    const handleEnhancedUnarmedSkip = () => {
        const pending = pendingDamage;
        if (!pending) {
            setModalState({ damageTypeChoice: null });
            return;
        }
        const { attack, formula, total, rolls, rider, _attackRider } = pending;
        if (_attackRider) {
            const usedKey = `_${_attackRider.name.replace(/\s+/g, '_')}_usedRound`;
            setRuntimeValue(playerStats.name, usedKey, getCurrentCombatRound(), campaignName);
        }
        setModalState({ damageTypeChoice: null });
        setPendingDamage(null);
        proceedWithDamage(attack, formula, total, rolls, rider);
    };

    const handleFeatureChoiceConfirm = (chosenOption) => {
        const featureChoice = modalState.featureChoice;
        if (!featureChoice) return;
        const { action, optionKey } = featureChoice;
        setRuntimeValue(playerStats.name, optionKey, chosenOption, campaignName);
        setModalState({ featureChoice: null });
        const restMessage = (action.automation?.type === 'hunter_prey' || action.automation?.type === 'defensive_tactics')
            ? 'This choice can be changed on a Short or Long Rest.'
            : 'This choice can be changed by clicking the feature again.';
        setPopupHtml(`<b>${action.name}</b><br/>Option chosen: <b>${chosenOption}</b>. ${restMessage}`);
    };

    const handleFeatureChoiceSkip = () => {
        setModalState({ featureChoice: null });
    };

    const handleConstellationSelect = async (payload, optionName) => {
        const { action, playerStats: ps, campaignName: cn } = payload;
        const isTwinkled = ps.level >= 10;
        let result;
        if (isTwinkled) {
            result = await twinklingApply(action, ps, cn, optionName);
        } else {
            result = await applyConstellationOption(action, ps, cn, optionName);
        }
        if (result) {
            setPopupHtml(result.payload);
        }
        setModalState({ starryFormConstellationModal: null, twinklingConstellationModal: null });
    };

    const handleWeaponKindMasteryClose = () => {
        setModalState({ weaponKindMasteryModal: null });
    };

    return {
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
        handleWeaponKindMasteryClose,
    };
}
