import { useState } from 'react';

const DAMAGE_ROLL_TYPES = new Set(['damage', 'save-damage', 'aoe-damage', 'overchannel-damage', 'graze-damage']);
const CHECK_ROLL_TYPES = new Set(['check', 'skill']);

function computeIsDamageType(type, rollType) {
    return DAMAGE_ROLL_TYPES.has(type) || DAMAGE_ROLL_TYPES.has(rollType);
}

function computeFinalRoll(mode, safeRolls) {
    const r1 = safeRolls[0] || 0;
    const r2 = safeRolls[1] || 0;
    if (mode === 'advantage') return Math.max(r1, r2);
    if (mode === 'disadvantage') return Math.min(r1, r2);
    return r1;
}

function computeDisplayRoll({ luckyRerolled, luckyRerollValue, strokeResult, rerollResult, bardicInspirationResult, finalRoll }) {
    if (luckyRerolled) return luckyRerollValue;
    if (strokeResult !== null) return 20;
    if (rerollResult !== null) return rerollResult.roll;
    if (bardicInspirationResult !== null) return bardicInspirationResult.d20Roll;
    return finalRoll;
}

function computeDisplayTotal({ luckyRerolled, luckyRerollValue, bonus, modifier, strokeResult, rerollResult, bardicInspirationResult, originalTotal }) {
    if (luckyRerolled) return luckyRerollValue + bonus + modifier;
    if (strokeResult !== null) return 20 + bonus + modifier;
    if (rerollResult !== null) return rerollResult.total;
    if (bardicInspirationResult !== null) return bardicInspirationResult.total;
    return originalTotal;
}

function computeBaseTotal({ starryDragonFloorTotal, d20Floor10Total, reliableTalentTotal, wisCheckApplies, wisDisplayTotal, finalDisplayTotal }) {
    if (starryDragonFloorTotal !== null) return starryDragonFloorTotal;
    if (d20Floor10Total !== null) return d20Floor10Total;
    if (reliableTalentTotal !== null) return reliableTalentTotal;
    if (wisCheckApplies) return wisDisplayTotal;
    return finalDisplayTotal;
}

function computeEffectiveAc(props) {
    if (props.effectiveAc !== undefined) return props.effectiveAc;
    if (props.targetAc === undefined) return undefined;
    return props.targetAc + (props.coverAcBonus || 0) + (props.defensiveDuelistBonus || 0) + (props.baitAndSwitchBonus || 0)
        + (props.shieldAcBonus || 0) + (props.shieldOfFaithAcBonus || 0) + (props.wardingBondAcBonus || 0) - (props.slowAcPenalty || 0);
}

function computeD20TestFailed({ waitingForPlayerSave, computedHit, isAutoMiss, saveResult, success }) {
    if (waitingForPlayerSave) return false;
    if (computedHit !== undefined) return !computedHit && !isAutoMiss;
    if (saveResult && saveResult.success !== undefined) return saveResult.success !== true;
    return success !== true;
}

function computeStrReplace({ strSaveReplace, strCheckReplace, rollType, displayTotal, strScore }) {
    const appliesReplace = (strSaveReplace && rollType === 'save') || (strCheckReplace && CHECK_ROLL_TYPES.has(rollType));
    const strReplaceApplied = appliesReplace && displayTotal < (strScore || 10);
    const finalDisplayTotal = strReplaceApplied ? strScore : displayTotal;
    return { appliesReplace, strReplaceApplied, finalDisplayTotal };
}

function computeWisTotals({ wisCheckReplace, wisCheckMinBonus, bonus, modifier, rollType, finalRoll, displayTotal }) {
    const wisBonus = wisCheckReplace ? (wisCheckMinBonus || 1) : bonus;
    const wisCheckApplies = wisCheckReplace && CHECK_ROLL_TYPES.has(rollType);
    const wisDisplayTotal = wisCheckApplies ? finalRoll + wisBonus + modifier : displayTotal;
    return { wisBonus, wisCheckApplies, wisDisplayTotal };
}

function computeFloorTotals({ reliableTalent, d20Floor10, starryDragonFloor, displayRoll, bonus, modifier, rollType }) {
    const reliableTalentTotal = reliableTalent && CHECK_ROLL_TYPES.has(rollType) && displayRoll <= 9 ? 10 + bonus + modifier : null;
    const d20Floor10Total = d20Floor10 && displayRoll <= 9 ? 10 + bonus + modifier : null;
    const starryDragonFloorTotal = starryDragonFloor && displayRoll <= 9 ? 10 + bonus + modifier : null;
    return { reliableTalentTotal, d20Floor10Total, starryDragonFloorTotal };
}

export function useDiceRollState(props) {
    const {
        rolls, rollType, bonus = 0, modifier = 0, total = 0,
        hit, isAutoMiss,
        reliableTalent, d20Floor10, starryDragonFloor, strSaveReplace, strCheckReplace, strScore,
        wisCheckReplace, wisCheckMinBonus, luckyRerolled, luckyRerollValue,
        targetName, homingStrikesBonus,
    } = props;

    const {
        isCrit, isAutoCrit, type, forcedMode, isNatural1,
    } = props;

    const [mode, setMode] = useState(forcedMode || 'normal');
    const [rerollUsed, setRerollUsed] = useState(false);
    const [rerollResult, setRerollResult] = useState(null);
    const [tacticalUsed, setTacticalUsed] = useState(false);
    const [tacticalResult, setTacticalResult] = useState(null);
    const [tacticalDeclared, setTacticalDeclared] = useState(null);
    const [strokeUsed, setStrokeUsed] = useState(false);
    const [strokeResult, setStrokeResult] = useState(null);
    const [bardicInspirationUsed, setBardicInspirationUsed] = useState(false);
    const [bardicInspirationResult, setBardicInspirationResult] = useState(null);
    const [bardicInspirationDefenseUsed, setBardicInspirationDefenseUsed] = useState(false);
    const [bardicInspirationDefenseResult, setBardicInspirationDefenseResult] = useState(null);
    const [bardicInspirationOffenseUsed, setBardicInspirationOffenseUsed] = useState(false);
    const [bardicInspirationOffenseResult, setBardicInspirationOffenseResult] = useState(null);
    const [superiorityUsed, setSuperiorityUsed] = useState(false);
    const [superiorityResult, setSuperiorityResult] = useState(null);
    const [psiKnackClicked, setPsiKnackClicked] = useState(false);
    const [psiKnackResult, setPsiKnackResult] = useState(null);
    const [psiKnackConsumed, setPsiKnackConsumed] = useState(false);
    const [empoweredSpellUsed, setEmpoweredSpellUsed] = useState(false);
    const [empoweredSpellResult, setEmpoweredSpellResult] = useState(null);
    const [darkOnesLuckUsed, setDarkOnesLuckUsed] = useState(false);
    const [darkOnesLuckResult, setDarkOnesLuckResult] = useState(null);
    const [boonUsed, setBoonUsed] = useState(false);
    const [punctureUsed, setPunctureUsed] = useState(false);
    const [punctureResult, setPunctureResult] = useState(null);
    const [savageAttackerUsed, setSavageAttackerUsed] = useState(false);
    const [savageAttackerResult, setSavageAttackerResult] = useState(null);

    const isD20 = type === 'd20';
    const isDamageType = computeIsDamageType(type, rollType);
    const isHealType = type === 'heal';
    const isCritDamage = isDamageType && (isCrit || isAutoCrit);

    const safeRolls = Array.isArray(rolls) ? rolls : [];
    const finalRoll = isD20 ? computeFinalRoll(mode, safeRolls) : safeRolls.reduce((sum, r) => sum + r, 0);

    const originalTotal = (isDamageType || isHealType) ? total : (finalRoll + bonus + modifier);
    const displayRoll = computeDisplayRoll({ luckyRerolled, luckyRerollValue, strokeResult, rerollResult, bardicInspirationResult, finalRoll });
    const displayTotal = computeDisplayTotal({ luckyRerolled, luckyRerollValue, bonus, modifier, strokeResult, rerollResult, bardicInspirationResult, originalTotal });
    const { appliesReplace, strReplaceApplied, finalDisplayTotal } = computeStrReplace({ strSaveReplace, strCheckReplace, rollType, displayTotal, strScore });
    const { wisBonus, wisCheckApplies, wisDisplayTotal } = computeWisTotals({ wisCheckReplace, wisCheckMinBonus, bonus, modifier, rollType, finalRoll, displayTotal });
    const { reliableTalentTotal, d20Floor10Total, starryDragonFloorTotal } = computeFloorTotals({ reliableTalent, d20Floor10, starryDragonFloor, displayRoll, bonus, modifier, rollType });
    const baseTotal = computeBaseTotal({ starryDragonFloorTotal, d20Floor10Total, reliableTalentTotal, wisCheckApplies, rollType, wisDisplayTotal, finalDisplayTotal });
    // CLA-320: Homing Strikes (Soul Blades) — the authoritative resolver has
    // already folded the psionic die into the attack; mirror it here so the
    // popup's recomputed hit agrees with the flipped hit and "Done" appears.
    const homingStrikesApplied = rollType === 'attack' && Number(homingStrikesBonus) > 0 && !isAutoMiss;
    const finalTotal = baseTotal + (homingStrikesApplied ? Number(homingStrikesBonus) : 0);
    const showFumble = isNatural1 && rollType === 'attack';

    // SP-105: trust the resolver's authoritative effectiveAc when forwarded
    // (covers Shield of Faith, Shield, cover, reactions); otherwise recompute
    // from the forwarded per-bonus fields so computedHit agrees with hit.
    const effectiveAc = computeEffectiveAc(props);
    const computedHit = isAutoMiss ? false : (targetName && hit !== undefined && effectiveAc !== undefined ? finalTotal >= effectiveAc : hit);

    const isSaveDamageType = type === 'save-damage';

    // CLA-339: Stroke of Luck triggers only on a FAILED D20 Test. Mirrors the
    // verified failure-only offer gates (Boon of Combat Prowess: !hit &&
    // !isAutoMiss; Psi-Bolstered Knack: success !== true). When no outcome
    // flag is known (adjudicated check), the offer stands.
    const { saveResult, success, waitingForPlayerSave } = props;
    const d20TestFailed = computeD20TestFailed({ waitingForPlayerSave, computedHit, isAutoMiss, saveResult, success });

    return {
        mode, setMode,
        rerollUsed, setRerollUsed, rerollResult, setRerollResult,
        tacticalUsed, setTacticalUsed, tacticalResult, setTacticalResult,
        tacticalDeclared, setTacticalDeclared,
        strokeUsed, setStrokeUsed, strokeResult, setStrokeResult,
        bardicInspirationUsed, setBardicInspirationUsed, bardicInspirationResult, setBardicInspirationResult,
        bardicInspirationDefenseUsed, setBardicInspirationDefenseUsed, bardicInspirationDefenseResult, setBardicInspirationDefenseResult,
        bardicInspirationOffenseUsed, setBardicInspirationOffenseUsed, bardicInspirationOffenseResult, setBardicInspirationOffenseResult,
        superiorityUsed, setSuperiorityUsed, superiorityResult, setSuperiorityResult,
        psiKnackClicked, setPsiKnackClicked, psiKnackResult, setPsiKnackResult, psiKnackConsumed, setPsiKnackConsumed,
        empoweredSpellUsed, setEmpoweredSpellUsed, empoweredSpellResult, setEmpoweredSpellResult,
        darkOnesLuckUsed, setDarkOnesLuckUsed, darkOnesLuckResult, setDarkOnesLuckResult,
        boonUsed, setBoonUsed,
        punctureUsed, setPunctureUsed, punctureResult, setPunctureResult,
        savageAttackerUsed, setSavageAttackerUsed, savageAttackerResult, setSavageAttackerResult,
        isD20, isDamageType, isHealType, isCritDamage, isSaveDamageType,
        safeRolls, finalRoll, originalTotal, displayRoll, displayTotal,
        appliesReplace, strReplaceApplied, finalDisplayTotal, wisBonus, wisDisplayTotal,
        reliableTalentTotal, d20Floor10Total, starryDragonFloorTotal, finalTotal, showFumble,
        effectiveAc, computedHit, isNatural1, homingStrikesApplied, d20TestFailed,
    };
}
