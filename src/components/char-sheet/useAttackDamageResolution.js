import { rollExpression } from '../../services/dice/diceRoller.js';
import { evaluateAutoExpression } from '../../services/combat/automation/automationService.js';
import { executeAttackRiderManeuver as executeAttackRiderManeuverService } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';
import { buildPipelineForAction } from '../../services/combat/steps/index.js';

export default function useAttackDamageResolution({
    playerStats, campaignName, mapName,
    popupHtml, setPopupHtml, rollDamage, buildCtx, buildCtxSync,
    setDamageTypeChoice, setDivineFuryChoice, setWeaponMasteryModal: _, setAttackRiderModal,
    setAttackRiderManeuverPrompt,
    setSweepingAttackTargetModal,
    pendingDamageRef,
    setSecondaryTargetModal,
}) {
    const proceedWithDamage = (attack, formula, total, rolls, modifier) => {
        (mapName ? buildCtx(attack) : buildCtxSync(attack)).then(ctx => {
            rollDamage(attack.name, formula, total, rolls, modifier, ctx);
        }).catch((e) => { console.error("[useAttackDamageResolution] Error:", e); });
    };

    const resolveAttackDamage = async (attack) => {
        const ctx = {
            attack,
            playerStats,
            campaignName,
            mapName,
            popupHtml,
            hit: popupHtml?.hit === true || popupHtml?.isCrit === true,
            isCrit: popupHtml?.isCrit === true,
            isNatural20: popupHtml?.isNatural20 === true,
            targetName: popupHtml?.targetName || null,
            isBonusActionAttack: attack?.type === 'Bonus Action',
            formula: null,
            total: 0,
            rolls: [],
            modifier: 0,
            sneakDice: 0,
            effectiveSneakDice: 0,
            isMeleeOrUnarmed: false,
            buildCtxResult: null,
            autoFormulaOverride: null,
            overchannelActive: false,
            overchannelUseCount: 0,
            overchannelSpellLevel: 1,
            autoDamageSaveDc: null,
            setPopupHtml,
            setDamageTypeChoice,
            setDivineFuryChoice,
            setAttackRiderModal,
            setAttackRiderManeuverPrompt,
            setSweepingAttackTargetModal,
            setSecondaryTargetModal,
            buildCtx,
            buildCtxSync,
            proceedWithDamage,
        };

        const pipeline = buildPipelineForAction(attack, playerStats);
        await pipeline.run('housekeeping:do', ctx, pendingDamageRef);
    };

    const handleAttackRiderManeuverUse = async (maneuver, attack, popupHtmlData, currentFormula, currentTotal, currentRolls) => {
        const maneuverName = maneuver?.name || maneuver;
        const attackInfo = {
            weaponType: attack.weaponType,
            isUnarmedStrike: attack.weaponType === 'unarmed',
            targetName: popupHtmlData?.targetName || null,
        };
        const action = { automation: {} };
        const result = await executeAttackRiderManeuverService(action, playerStats, campaignName, maneuverName, attackInfo);

        let updatedFormula = currentFormula;
        let updatedTotal = currentTotal;
        let updatedRolls = [...currentRolls];

        if (popupHtmlData?.isMiss && popupHtml) {
            if (maneuver && maneuver.effect === 'attack_roll_bonus') {
                const dieRoll = rollExpression(maneuver.dieExpression || 'superiority_die');
                const dieValue = dieRoll?.total || evaluateAutoExpression(maneuver.dieExpression || 'superiority_die', playerStats);
                const origD20 = (popupHtml.rolls?.[0] != null && popupHtml.rolls[0] !== 20) ? popupHtml.rolls[0] : (popupHtml.rolls?.[0] || 0);
                const origBonus = popupHtml.bonus || 0;
                const origTotal = origD20 + origBonus;
                const newTotal = origTotal + dieValue;
                const targetAC = popupHtml.targetAc || 10;
                const newHit = newTotal >= targetAC;
                const isNatural20 = origD20 === 20;
                const wasCrit = popupHtml.isCrit;

                const updatedPopup = {
                    ...popupHtml,
                    total: newTotal,
                    hit: newHit,
                    isCrit: isNatural20 || wasCrit,
                    isNatural20: isNatural20,
                    superiorityDieAdded: dieValue,
                    originalTotal: origTotal,
                    originalD20: origD20,
                };

                const dieDesc = `Precision Attack: Added ${dieValue} to the attack roll (${origD20} + ${origBonus} + ${dieValue} = ${newTotal}). ${newHit ? 'The attack now hits!' : 'The attack still misses.'}`;

                setAttackRiderManeuverPrompt(null);
                setPopupHtml(updatedPopup);

                return {
                    formula: updatedFormula,
                    total: updatedTotal,
                    rolls: updatedRolls,
                    isMissResult: true,
                    hit: newHit,
                    description: dieDesc,
                };
            }
        } else {
            if (result?.type === 'popup') {
                if (maneuver?.damageBonus) {
                    const dieRoll = rollExpression(maneuver.dieExpression || 'superiority_die');
                    const dieValue = dieRoll?.total || evaluateAutoExpression(maneuver.dieExpression || 'superiority_die', playerStats);
                    const dmgType = attack.damageType || 'same_as_weapon';
                    updatedFormula += ` + ${dieValue} [${dmgType}]`;
                    updatedTotal += dieValue;
                    updatedRolls = [...updatedRolls, dieValue];
                }
            }

            setAttackRiderManeuverPrompt(null);
            if (result?.type === 'popup') {
                setPopupHtml(result.payload);
            }
            if (result?.type === 'modal' && result.modalName === 'sweepingAttackTarget') {
                setSweepingAttackTargetModal(result.payload);
            }
        }

        return { formula: updatedFormula, total: updatedTotal, rolls: updatedRolls };
    };

    const handleAttackRiderManeuverSkip = () => {
        setAttackRiderManeuverPrompt(null);
    };

    return { resolveAttackDamage, proceedWithDamage, handleAttackRiderManeuverUse, handleAttackRiderManeuverSkip };
}
