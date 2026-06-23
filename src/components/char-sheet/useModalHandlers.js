import { rollExpression } from '../../services/dice/diceRoller.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { getDistanceFeet } from '../../services/rules/combat/rangeValidation.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { applyConstellationOption } from '../../services/automation/handlers/class-sorcerer/starryFormHandler.js';
import { applyConstellationOption as twinklingApply } from '../../services/automation/handlers/class-sorcerer/twinklingConstellationHandler.js';
import { handleRestore } from '../../services/automation/handlers/class-cleric-paladin/elderChampionHandler.js';

export default function useModalHandlers({
    playerStats, campaignName,
    rollDamage, proceedWithDamage,
    pendingDamageRef,
    cleaveAttackPending,
    featureChoice,
    setDamageTypeChoice, setDivineFuryChoice,
    setWeaponMasteryModal, setWeaponMasteryChoiceModal, setWeaponKindMasteryModal,
    setCleaveAttackPending,
    setFeatureChoice,
    setStarryFormConstellationModal, setTwinklingConstellationModal,
    setPopupHtml,
}) {
    const handleMasteryClose = async () => {
        setWeaponMasteryModal(null);
        if (pendingDamageRef.current) {
            const { attack, formula, total, rolls, modifier } = pendingDamageRef.current;
            // Check if Cleave was activated — look for cleave effect in targetEffects
            const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
            const cleaveEffect = storedEffects.find(te => te.effect === 'cleave');
            if (cleaveEffect) {
                // Clear the cleave effect so it doesn't trigger again
                const filteredEffects = storedEffects.filter(te => te.effect !== 'cleave');
                setRuntimeValue(campaignName, 'targetEffects', filteredEffects, campaignName);
                // Proceed with the first attack damage
                proceedWithDamage(attack, formula, total, rolls, modifier);
                pendingDamageRef.current = null;
                // Show cleave target selection
                const cs = await getCombatContext(campaignName);
                const firstTarget = cs?.creatures?.find(c => c.name === cleaveEffect.target);
                if (cs?.creatures && firstTarget?.position) {
                    const secondTargets = cs.creatures
                        .filter(c => c.name !== cleaveEffect.target && c.position)
                        .map(c => ({
                            creature: c,
                            distance: getDistanceFeet(firstTarget.position, c.position),
                        }))
                        .filter(t => t.distance !== null && t.distance <= 5);
                    if (secondTargets.length > 0) {
                        setCleaveAttackPending({
                            attackName: attack.name,
                            damage: attack.damage,
                            damageType: attack.damageType || 'same_as_weapon',
                            abilityName: attack.abilityName,
                            weaponType: attack.weaponType,
                            properties: attack.properties || [],
                            proficiencyBonus: attack.proficiencyBonus || playerStats.proficiency || 0,
                            abilities: playerStats.abilities || [],
                            campaignName,
                            playerStats,
                            secondTargets: secondTargets.map(t => t.creature),
                        });
                        return;
                    }
                }
            }
            proceedWithDamage(attack, formula, total, rolls, modifier);
            pendingDamageRef.current = null;
        }
    };

    const handleWeaponMasteryChoice = (_masteryName) => {
        setWeaponMasteryChoiceModal(null);
    };

    const handleCleaveAttack = async (cleaveTargetName) => {
        if (!cleaveTargetName) {
            setCleaveAttackPending(null);
            return;
        }
        const data = cleaveAttackPending;
        if (!data) return;
        setCleaveAttackPending(null);

        const { attackName, damage, damageType, abilityName, proficiencyBonus, abilities, campaignName: cleaveCampaign } = data;

        const ability = abilities?.find(a => a.name === abilityName);
        const abilityMod = ability?.bonus || 0;
        const attackBonus = abilityMod + proficiencyBonus;

        const cs = await getCombatContext(cleaveCampaign);
        const target = cs?.creatures?.find(c => c.name === cleaveTargetName);
        const targetAc = target?.ac || 0;

        const d20Roll = Math.floor(Math.random() * 20) + 1;
        const totalRoll = d20Roll + attackBonus;
        const hit = totalRoll >= targetAc;

        let damageFormula = damage;
        let damageResult = null;
        if (hit) {
            const negMod = abilityMod < 0 ? abilityMod : 0;
            if (negMod < 0) {
                damageFormula = `${damage} + ${negMod}[${abilityName}]`;
            } else {
                const parts = damage.split(' + ');
                const filteredParts = parts.filter(part => {
                    const match = part.match(/^\d+\[([^\]]+)\]$/);
                    return !match || match[1] !== abilityName;
                });
                damageFormula = filteredParts.length > 0 ? filteredParts.join(' + ') : parts[0];
            }
            damageResult = rollExpression(damageFormula);
        }

        if (hit && damageResult) {
            const context = {
                targetName: cleaveTargetName,
                damageType,
                attackerName: playerStats.name,
            };
            rollDamage(`${attackName} (Cleave)`, damageFormula, damageResult.total, damageResult.rolls, 0, context);
        } else {
            const context = {
                targetName: cleaveTargetName,
                damageType,
                attackerName: playerStats.name,
                isAutoMiss: true,
            };
            rollDamage(`${attackName} (Cleave)`, damageFormula, 0, [], 0, context);
        }
    };

    const handleCleaveSkip = () => {
        setCleaveAttackPending(null);
    };

    const handleDivineFuryDamageType = (chosenType) => {
        const pending = pendingDamageRef.current;
        if (!pending) {
            setDivineFuryChoice(null);
            return;
        }
        const { attack, formula, total, rolls, modifier, bonusExpr, bonusTotal, bonusRolls } = pending;
        const newFormula = `${formula} + ${bonusExpr}[${chosenType}]`;
        const newTotal = total + bonusTotal;
        const newRolls = [...rolls, ...bonusRolls];
        const playerName = playerStats.name;
        const currentRound = getCurrentCombatRound();
        setRuntimeValue(playerName, '_divineFuryUsedRound', currentRound, campaignName);
        setDivineFuryChoice(null);
        pendingDamageRef.current = null;
        proceedWithDamage(attack, newFormula, newTotal, newRolls, modifier);
    };

    const handleDivineFurySkip = () => {
        const pending = pendingDamageRef.current;
        if (!pending) {
            setDivineFuryChoice(null);
            return;
        }
        const { attack, formula, total, rolls, modifier } = pending;
        setDivineFuryChoice(null);
        pendingDamageRef.current = null;
        proceedWithDamage(attack, formula, total, rolls, modifier);
    };

    const handleGenericDamageTypeChoice = (chosenType) => {
        const pending = pendingDamageRef.current;
        if (!pending) {
            setDamageTypeChoice(null);
            return;
        }
        const { attack, formula, total, rolls, modifier, bonusExpr, bonusTotal, bonusRolls, oncePerTurnKey } = pending;
        const newFormula = `${formula} + ${bonusExpr}[${chosenType}]`;
        const newTotal = total + bonusTotal;
        const newRolls = [...rolls, ...bonusRolls];
        if (oncePerTurnKey) {
            setRuntimeValue(playerStats.name, oncePerTurnKey, getCurrentCombatRound(), campaignName);
        }
        setDamageTypeChoice(null);
        pendingDamageRef.current = null;
        proceedWithDamage(attack, newFormula, newTotal, newRolls, modifier);
    };

    const handleGenericDamageTypeSkip = () => {
        const pending = pendingDamageRef.current;
        if (!pending) {
            setDamageTypeChoice(null);
            return;
        }
        const { attack, formula, total, rolls, modifier } = pending;
        setDamageTypeChoice(null);
        pendingDamageRef.current = null;
        proceedWithDamage(attack, formula, total, rolls, modifier);
    };

    const handleDamageTypeModifierChoice = (chosenType) => {
        const pending = pendingDamageRef.current;
        if (!pending) {
            setDamageTypeChoice(null);
            return;
        }
        const { attack, formula, total, rolls, modifier, _damageTypeModifier } = pending;
        if (_damageTypeModifier) {
            attack.damageType = chosenType;
            const usedKey = `_${_damageTypeModifier.name.replace(/\s+/g, '_')}_usedRound`;
            setRuntimeValue(playerStats.name, usedKey, getCurrentCombatRound(), campaignName);
        }
        setDamageTypeChoice(null);
        pendingDamageRef.current = null;
        proceedWithDamage(attack, formula, total, rolls, modifier);
    };

    const handleDamageTypeModifierSkip = () => {
        const pending = pendingDamageRef.current;
        if (!pending) {
            setDamageTypeChoice(null);
            return;
        }
        const { attack, formula, total, rolls, modifier, _damageTypeModifier } = pending;
        if (_damageTypeModifier) {
            const usedKey = `_${_damageTypeModifier.name.replace(/\s+/g, '_')}_usedRound`;
            setRuntimeValue(playerStats.name, usedKey, getCurrentCombatRound(), campaignName);
        }
        setDamageTypeChoice(null);
        pendingDamageRef.current = null;
        proceedWithDamage(attack, formula, total, rolls, modifier);
    };

    const handleEnhancedUnarmedChoice = (chosenOptionName) => {
        const pending = pendingDamageRef.current;
        if (!pending) {
            setDamageTypeChoice(null);
            return;
        }
        const { attack, formula, total, rolls, rider, _attackRider } = pending;
        if (_attackRider) {
            const chosenOption = _attackRider.options.find(o => o.name === chosenOptionName);
            if (chosenOption && chosenOption.effect === 'damage_bonus') {
                const riderResult = rollExpression(chosenOption.damageExpression);
                if (riderResult) {
                    const newFormula = `${formula} + ${chosenOption.damageExpression}[${chosenOption.damageType || 'same_as_weapon'}]`;
                    const newTotal = total + riderResult.total;
                    const newRolls = [...rolls, ...riderResult.rolls];
                    const usedKey = `_${_attackRider.name.replace(/\s+/g, '_')}_usedRound`;
                    setRuntimeValue(playerStats.name, usedKey, getCurrentCombatRound(), campaignName);
                    setDamageTypeChoice(null);
                    pendingDamageRef.current = null;
                    proceedWithDamage(attack, newFormula, newTotal, newRolls, rider);
                    return;
                }
            }
        }
        setDamageTypeChoice(null);
        pendingDamageRef.current = null;
        proceedWithDamage(attack, formula, total, rolls, rider);
    };

    const handleEnhancedUnarmedSkip = () => {
        const pending = pendingDamageRef.current;
        if (!pending) {
            setDamageTypeChoice(null);
            return;
        }
        const { attack, formula, total, rolls, rider, _attackRider } = pending;
        if (_attackRider) {
            const usedKey = `_${_attackRider.name.replace(/\s+/g, '_')}_usedRound`;
            setRuntimeValue(playerStats.name, usedKey, getCurrentCombatRound(), campaignName);
        }
        setDamageTypeChoice(null);
        pendingDamageRef.current = null;
        proceedWithDamage(attack, formula, total, rolls, rider);
    };

    const handleFeatureChoiceConfirm = (chosenOption) => {
        if (!featureChoice) return;
        const { action, optionKey } = featureChoice;
        setRuntimeValue(playerStats.name, optionKey, chosenOption, campaignName);
        setFeatureChoice(null);
        const restMessage = (action.automation?.type === 'hunter_prey' || action.automation?.type === 'defensive_tactics')
            ? 'This choice can be changed on a Short or Long Rest.'
            : 'This choice can be changed by clicking the feature again.';
        setPopupHtml(`<b>${action.name}</b><br/>Option chosen: <b>${chosenOption}</b>. ${restMessage}`);
    };

    const handleFeatureChoiceSkip = () => {
        setFeatureChoice(null);
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
        setStarryFormConstellationModal(null);
        setTwinklingConstellationModal(null);
    };

    const handleElderChampionRestore = async (payload) => {
        const { action, playerStats: ps, campaignName: cn } = payload;
        const result = await handleRestore(action, ps, cn);
        if (result) {
            setPopupHtml(result.payload);
        }
    };

    const handleWeaponKindMasteryClose = () => {
        setWeaponKindMasteryModal(null);
    };

    return {
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
        handleWeaponKindMasteryClose,
    };
}
