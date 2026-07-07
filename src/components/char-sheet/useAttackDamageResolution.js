import { rollExpression } from '../../services/dice/diceRoller.js';
import { evaluateAutoExpression } from '../../services/combat/automation/automationService.js';
import { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } from '../../services/rules/spells/postCastRiderService.js';
import { executeAttackRiderManeuver as executeAttackRiderManeuverService } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';
import { buildPipelineForAction } from '../../services/combat/steps/index.js';

/**
 * Normalize an autoDamage object (from dice roll popup) into an attack-like object
 * + context overrides for the pipeline.
 *
 * @param {object} autoDamage - The autoDamage object from the dice roll popup
 * @param {boolean} isCrit - Whether the attack was a critical hit
 * @param {object} playerStats - The acting character's computed stats
 * @returns {{ attack: object, ctx: object }}
 */
export function normalizeAutoDamage(autoDamage, isCrit, playerStats) {
  const attack = {
    name: autoDamage.name,
    damage: autoDamage.formula,
    damageType: autoDamage.damageType,
    weaponType: 'weapon',
    properties: [],
  };

  // Compute Empowered Evocation modifier
  const hasEmpoweredEvoc = getEmpoweredEvocationFeatures(playerStats).length > 0;
  const empEvocIntMod = hasEmpoweredEvoc ? getEmpoweredEvocationIntModifier(playerStats) : 0;
  const spellSchool = (autoDamage.autoDamageSchool || '').toLowerCase();
  const shouldApplyEmpoweredEvoc = hasEmpoweredEvoc && spellSchool === 'evocation' && empEvocIntMod > 0;

  const ctx = {
    hit: true,
    isCrit: isCrit || autoDamage.isAutoCrit || false,
    isNatural20: isCrit || false,
    targetName: autoDamage.targetName || null,
    isBonusActionAttack: false,
    overchannelActive: autoDamage.overchannelActive || false,
    overchannelUseCount: autoDamage.overchannelUseCount || 0,
    overchannelSpellLevel: autoDamage.overchannelSpellLevel || 1,
    sneakDice: autoDamage.sneakAttackDice || 0,
    saveDc: autoDamage.saveDc,
    saveType: autoDamage.saveType,
    dcSuccess: autoDamage.dcSuccess,
    autoDamageSource: true,
    empoweredEvocationModifier: shouldApplyEmpoweredEvoc ? empEvocIntMod : 0,
  };

  return { attack, ctx };
}

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

    /**
     * Run the attack damage pipeline. For manual damage clicks, context comes from popupHtml.
     * For auto-damage (after an attack roll), pass ctxOverrides from normalizeAutoDamage().
     */
    const resolveAttackDamage = async (attack, ctxOverrides = {}) => {
        const ctx = {
            attack,
            playerStats,
            campaignName,
            mapName,
            popupHtml,
            hit: ctxOverrides.hit ?? (popupHtml?.hit === true || popupHtml?.isCrit === true),
            isCrit: ctxOverrides.isCrit ?? (popupHtml?.isCrit === true),
            isNatural20: ctxOverrides.isNatural20 ?? (popupHtml?.isNatural20 === true),
            targetName: ctxOverrides.targetName ?? (popupHtml?.targetName || null),
            isBonusActionAttack: ctxOverrides.isBonusActionAttack ?? (attack?.type === 'Bonus Action'),
            formula: null,
            total: 0,
            rolls: [],
            modifier: 0,
            sneakDice: 0,
            effectiveSneakDice: 0,
            isMeleeOrUnarmed: false,
            buildCtxResult: null,
            autoFormulaOverride: null,
            overchannelActive: ctxOverrides.overchannelActive ?? false,
            overchannelUseCount: ctxOverrides.overchannelUseCount ?? 0,
            overchannelSpellLevel: ctxOverrides.overchannelSpellLevel ?? 1,
            autoDamageSaveDc: null,
            empoweredEvocationModifier: ctxOverrides.empoweredEvocationModifier ?? 0,
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
            ...ctxOverrides,
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
