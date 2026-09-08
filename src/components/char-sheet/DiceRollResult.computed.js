import { useState } from 'react';

export function useDiceRollState(props) {
    const {
        rolls, rollType, bonus = 0, modifier = 0, total = 0,
        targetAc, hit, isAutoMiss, coverAcBonus, defensiveDuelistBonus, baitAndSwitchBonus,
        shieldAcBonus, shieldOfFaithAcBonus, slowAcPenalty,
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
    const isDamageType = type === 'damage' || rollType === 'damage' || type === 'save-damage' || rollType === 'save-damage' || type === 'aoe-damage' || rollType === 'aoe-damage' || type === 'overchannel-damage' || rollType === 'overchannel-damage' || type === 'graze-damage' || rollType === 'graze-damage';
    const isHealType = type === 'heal';
    const isCritDamage = isDamageType && (isCrit || isAutoCrit);

    const safeRolls = Array.isArray(rolls) ? rolls : [];
    let finalRoll = 0;

    if (isD20) {
        const r1 = safeRolls[0] || 0;
        const r2 = safeRolls[1] || 0;

        if (mode === 'advantage') {
            finalRoll = Math.max(r1, r2);
        } else if (mode === 'disadvantage') {
            finalRoll = Math.min(r1, r2);
        } else {
            finalRoll = r1;
        }
    } else {
        finalRoll = safeRolls.reduce((sum, r) => sum + r, 0);
    }

    const originalTotal = (isDamageType || isHealType) ? total : (finalRoll + bonus + modifier);
    const displayRoll = luckyRerolled ? luckyRerollValue : (strokeResult !== null ? 20 : (rerollResult !== null ? rerollResult.roll : (bardicInspirationResult !== null ? bardicInspirationResult.d20Roll : finalRoll)));
    const displayTotal = luckyRerolled ? (luckyRerollValue + bonus + modifier) : (strokeResult !== null ? 20 + bonus + modifier : (rerollResult !== null ? rerollResult.total : (bardicInspirationResult !== null ? bardicInspirationResult.total : originalTotal)));
    const appliesReplace = (strSaveReplace && rollType === 'save') || (strCheckReplace && (rollType === 'check' || rollType === 'skill'));
    const strReplaceApplied = appliesReplace && displayTotal < (strScore || 10);
    const finalDisplayTotal = strReplaceApplied ? strScore : displayTotal;
    const wisBonus = wisCheckReplace ? (wisCheckMinBonus || 1) : bonus;
    const wisDisplayTotal = wisCheckReplace && (rollType === 'check' || rollType === 'skill') ? finalRoll + wisBonus + modifier : displayTotal;
    const reliableTalentTotal = reliableTalent && (rollType === 'check' || rollType === 'skill') && displayRoll <= 9 ? 10 + bonus + modifier : null;
    const d20Floor10Total = d20Floor10 && displayRoll <= 9 ? 10 + bonus + modifier : null;
    const starryDragonFloorTotal = starryDragonFloor && displayRoll <= 9 ? 10 + bonus + modifier : null;
    const baseTotal = (starryDragonFloorTotal !== null ? starryDragonFloorTotal : d20Floor10Total !== null ? d20Floor10Total : reliableTalentTotal !== null ? reliableTalentTotal : (wisCheckReplace && (rollType === 'check' || rollType === 'skill') ? wisDisplayTotal : finalDisplayTotal));
    // CLA-320: Homing Strikes (Soul Blades) — the authoritative resolver has
    // already folded the psionic die into the attack; mirror it here so the
    // popup's recomputed hit agrees with the flipped hit and "Done" appears.
    const homingStrikesApplied = rollType === 'attack' && Number(homingStrikesBonus) > 0 && !isAutoMiss;
    const finalTotal = baseTotal + (homingStrikesApplied ? Number(homingStrikesBonus) : 0);
    const showFumble = isNatural1 && rollType === 'attack';

    // SP-105: trust the resolver's authoritative effectiveAc when forwarded
    // (covers Shield of Faith, Shield, cover, reactions); otherwise recompute
    // from the forwarded per-bonus fields so computedHit agrees with hit.
    const effectiveAc = props.effectiveAc !== undefined
        ? props.effectiveAc
        : (targetAc !== undefined ? targetAc + (coverAcBonus || 0) + (defensiveDuelistBonus || 0) + (baitAndSwitchBonus || 0) + (shieldAcBonus || 0) + (shieldOfFaithAcBonus || 0) - (slowAcPenalty || 0) : undefined);
    const computedHit = isAutoMiss ? false : (targetName && hit !== undefined && effectiveAc !== undefined ? finalTotal >= effectiveAc : hit);

    const isSaveDamageType = type === 'save-damage';

    // CLA-339: Stroke of Luck triggers only on a FAILED D20 Test. Mirrors the
    // verified failure-only offer gates (Boon of Combat Prowess: !hit &&
    // !isAutoMiss; Psi-Bolstered Knack: success !== true). When no outcome
    // flag is known (adjudicated check), the offer stands.
    const { saveResult, success, waitingForPlayerSave } = props;
    const d20TestFailed = waitingForPlayerSave
        ? false
        : computedHit !== undefined
            ? (!computedHit && !isAutoMiss)
            : (saveResult && saveResult.success !== undefined)
                ? saveResult.success !== true
                : success !== true;

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
