// CLA-124/CLA-125: Evasion eligibility for the save-AoE adjudication lanes.
// The caster-AoE picker (SaveAttackAoeModal) previously read
// combatSummary.creatures[type=player].computedStats — persisted player
// entries are minimal stubs (encounterToInitiative.js, CLA-119 family) that
// never contain computedStats, so the fold was inert. This module is the
// shared, prop-agnostic source: full PlayerStats (computedStats.evasionEffects
// from rolled features), the Incapacitated exemption, shared/Leading Evasion,
// and Circle of Power — mirroring resolveSaveEvasion (saveProcessing.js:332)
// byte-for-byte in gate order. detail.evasionActive is preferred when present
// (the prompt roller already answered from full stats — useLoggedDiceRollEve
// ntHandlers.determineEvasion :51 convention).
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { isCircleOfPowerActive } from '../../automation/handlers/buffs/circleOfPowerHandler.js';
import { normalizeSaveType } from './applyDamage.js';

export function isSaveTargetIncapacitated(targetName, campaignName) {
    const targetConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    return targetConditions.some(c => String(c).toLowerCase() === 'incapacitated');
}

function computedEvasionEffects(characters, name) {
    const character = (characters || []).find(c => c.name === name);
    const effects = character && character.computedStats ? character.computedStats.evasionEffects : null;
    return Array.isArray(effects) ? effects : [];
}

function matchesSaveType(evasionEffects, normalizedSaveType) {
    return evasionEffects.some(ef => ef.saveType === normalizedSaveType);
}

function sharesEvasionWithTarget(character, targetName, normalizedSaveType) {
    if (character.name === targetName) return false;
    return character.computedStats && Array.isArray(character.computedStats.evasionEffects)
        && character.computedStats.evasionEffects.some(ef => ef.saveType === normalizedSaveType && ef.shareable && ef.shareRange >= 5);
}

// Mirrors resolveSaveEvasion (saveProcessing.js:332-343): own evasion is
// gated on NOT Incapacitated + dcSuccess 'half' + matching save type;
// shared evasion (shareRange >= 5) fills in; Circle of Power stacks last
// and is NOT Incapacitated-gated (the aura protects regardless).
export function resolveAoESaveEvasion({ characters, detail, targetName, saveType, dcSuccess, campaignName }) {
    const normalizedSaveType = normalizeSaveType(saveType);
    const isIncapacitated = isSaveTargetIncapacitated(targetName, campaignName);
    const halfDamage = dcSuccess === 'half';
    const hasOwnEvasion = !isIncapacitated && halfDamage && matchesSaveType(computedEvasionEffects(characters, targetName), normalizedSaveType);
    const hasSharedEvasion = !hasOwnEvasion && !isIncapacitated && halfDamage &&
        (characters || []).some(c => sharesEvasionWithTarget(c, targetName, normalizedSaveType));
    const hasCircleOfPower = isCircleOfPowerActive(targetName, campaignName);
    // detail.evasionActive includes the prompt roller's Circle of Power roll
    // (SavePromptModal computeHasEvasion) — count it as feature evasion ONLY
    // when the aura is not already attributed, keeping the CoP zero-on-success
    // channel separate (fail pays full damage there, SP-023).
    const promptFlaggedEvasion = !!detail && detail.evasionActive === true && !hasCircleOfPower;
    const featureEvasionActive = hasOwnEvasion || hasSharedEvasion || promptFlaggedEvasion;
    return {
        evasionActive: featureEvasionActive || hasCircleOfPower,
        featureEvasionActive,
        hasOwnEvasion,
        hasSharedEvasion,
        hasCircleOfPower,
        isIncapacitated,
        normalizedSaveType,
    };
}

// Name channel for the rollType:'evasion' ledger entry (logQuickRollEvasion
// name convention, useLoggedDiceRollSaves.js:173; Leading Evasion mirror of
// handleNpcSaveDamage.js:593).
export function evasionLedgerName(evasion) {
    if (evasion.hasOwnEvasion) return 'Evasion';
    if (evasion.hasSharedEvasion) return 'Leading Evasion';
    if (evasion.hasCircleOfPower) return 'Circle of Power';
    return 'Evasion';
}
