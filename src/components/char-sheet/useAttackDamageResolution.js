import { getRuntimeValue, setRuntimeObject, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../services/dice/diceRoller.js';
import { evaluateAutoExpression } from '../../services/combat/automation/automationService.js';
import { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } from '../../services/rules/spells/postCastRiderService.js';
import { executeAttackRiderManeuver as executeAttackRiderManeuverService } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';
import { buildPipelineForAction } from '../../services/combat/steps/index.js';

/**
 * Standalone resolveAttackDamage for use outside React hooks (e.g., CharSpells, MonsterCardModal).
 */
export async function resolveAttackDamageStandalone(attack, ctxOverrides, { playerStats, campaignName, setPopupHtml, rollDamage, setModalState: _setModalState }) {
    const modalState = {};
    const setModalStateFn = (updates) => { Object.assign(modalState, updates); };

    const proceedWithDamage = (a, formula, total, rolls, modifier) => {
        const o = ctxOverrides;
        const minimalCtx = {
            damageType: a.damageType,
            targetName: o.targetName || null,
            attackerName: o.attackerName || a.name,
            isAutoCrit: o.isCrit || false,
            doubledRolls: o.doubledRolls || null,
            playerStats: o.playerStats || null,
            autoDamageSecondaryFormula: o.autoDamageSecondaryFormula || null,
            autoDamageSecondaryName: o.autoDamageSecondaryName || null,
            autoDamageSecondaryDamageType: o.autoDamageSecondaryDamageType || null,
            saveDc: o.saveDc || null,
            saveType: o.saveType || null,
            dcSuccess: o.dcSuccess || null,
            metamagicTwinTarget: o.metamagicTwinTarget || null,
            metamagicHeighten: o.metamagicHeighten || false,
        };
        rollDamage(a.name, formula, total, rolls, modifier, minimalCtx);
    };

    const ctx = {
        attack,
        playerStats,
        campaignName,
        mapName: null,
        popupHtml: null,
        hit: ctxOverrides.hit ?? true,
        isCrit: ctxOverrides.isCrit ?? false,
        isNatural20: ctxOverrides.isNatural20 ?? false,
        targetName: ctxOverrides.targetName ?? null,
        isBonusActionAttack: ctxOverrides.isBonusActionAttack ?? false,
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
        setDamageTypeChoice: (v) => setModalStateFn({ damageTypeChoice: v }),
        setDivineFuryChoice: (v) => setModalStateFn({ divineFuryChoice: v }),
        setAttackRiderModal: (v) => setModalStateFn({ attackRiderModal: v }),
        setAttackRiderManeuverPrompt: (v) => setModalStateFn({ attackRiderManeuverPrompt: v }),
        setSweepingAttackTargetModal: (v) => setModalStateFn({ sweepingAttackTargetModal: v }),
        setSecondaryTargetModal: (v) => setModalStateFn({ secondaryTargetModal: v }),
        buildCtx: null,
        buildCtxSync: null,
        proceedWithDamage,
        rollDamage,
        ...ctxOverrides,
    };

    const pipeline = buildPipelineForAction(attack, playerStats);
    await pipeline.run('housekeeping:do', ctx, { current: null });
}

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
  const isUnarmed = autoDamage.name?.includes('Unarmed Strike');
  const attack = {
    name: autoDamage.name,
    damage: autoDamage.formula,
    damageType: autoDamage.damageType,
    weaponType: isUnarmed ? 'unarmed' : 'weapon',
    properties: [],
  };

  // Compute Empowered Evocation modifier
  const hasEmpoweredEvoc = playerStats ? getEmpoweredEvocationFeatures(playerStats).length > 0 : false;
  const empEvocIntMod = (hasEmpoweredEvoc && playerStats) ? getEmpoweredEvocationIntModifier(playerStats) : 0;
  const spellSchool = (autoDamage.autoDamageSchool || '').toLowerCase();
  const shouldApplyEmpoweredEvoc = hasEmpoweredEvoc && spellSchool === 'evocation' && empEvocIntMod > 0;

  const ctx = {
    hit: true,
    isCrit: isCrit || autoDamage.isAutoCrit || false,
    isAutoCrit: isCrit || autoDamage.isAutoCrit || false,
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
    autoDamageSecondaryFormula: autoDamage.secondaryFormula,
    autoDamageSecondaryName: autoDamage.secondaryName,
    autoDamageSecondaryDamageType: autoDamage.secondaryDamageType,
    attackerName: autoDamage.attackerName,
    isCantrip: autoDamage.isCantrip || false,
    metamagicHeighten: autoDamage.metamagicHeighten || false,
    metamagicTwinTarget: autoDamage.metamagicTwinTarget || null,
    autoDamageSchool: autoDamage.autoDamageSchool || '',
  };

  return { attack, ctx };
}

export default function useAttackDamageResolution({
    playerStats, campaignName, mapName,
    popupHtml, setPopupHtml, rollDamage, buildCtx, buildCtxSync,
    setModalState, _modalState,
    setPendingDamage,
    resumeRef = { current: null },
}) {
    let pendingCtxOverrides = {};

    const proceedWithDamage = (attack, formula, total, rolls, modifier) => {
        if (buildCtxSync) {
            (mapName ? buildCtx(attack) : buildCtxSync(attack)).then(ctx => {
                rollDamage(attack.name, formula, total, rolls, modifier, { ...ctx, ...pendingCtxOverrides });
            }).catch((e) => { console.error("[useAttackDamageResolution] Error:", e); });
        } else {
            const o = pendingCtxOverrides;
            const minimalCtx = {
                damageType: attack.damageType,
                targetName: o.targetName || null,
                attackerName: attack.name,
            };
            rollDamage(attack.name, formula, total, rolls, modifier, minimalCtx);
        }
    };

    /**
     * Run the attack damage pipeline. For manual damage clicks, context comes from popupHtml.
     * For auto-damage (after an attack roll), pass ctxOverrides from normalizeAutoDamage().
     */
    const resolveAttackDamage = async (attack, ctxOverrides = {}) => {
        pendingCtxOverrides = ctxOverrides;
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
            setDamageTypeChoice: (v) => setModalState({ damageTypeChoice: v }),
            setDivineFuryChoice: (v) => setModalState({ divineFuryChoice: v }),
            setAttackRiderModal: (v) => setModalState({ attackRiderModal: v }),
            setAttackRiderManeuverPrompt: (v) => setModalState({ attackRiderManeuverPrompt: v }),
            setSweepingAttackTargetModal: (v) => setModalState({ sweepingAttackTargetModal: v }),
            setSecondaryTargetModal: (v) => setModalState({ secondaryTargetModal: v }),
            setModalState,
            buildCtx,
            buildCtxSync,
            proceedWithDamage,
            rollDamage,
            ...ctxOverrides,
        };

        // Add resolveAttackDamage to context for nested attacks (e.g., Stalker's Flurry)
        ctx.resolveAttackDamage = resolveAttackDamage;

        const pipeline = buildPipelineForAction(attack, playerStats);
        await pipeline.run('housekeeping:do', ctx, resumeRef);
        if (resumeRef.current?._pausedStep) {
            const paused = resumeRef.current;
            if (paused._modalType === 'damageTypeChoice') {
                setModalState({ damageTypeChoice: paused._modalProps });
                setPendingDamage({
                    attack: paused.attack,
                    formula: paused.formula,
                    total: paused.total,
                    rolls: paused.rolls,
                    modifier: paused.modifier,
                    bonusExpr: paused.bonusExpr,
                    bonusTotal: paused.bonusTotal,
                    bonusRolls: paused.bonusRolls,
                    oncePerTurnKey: paused._weaponHitOnceKey,
                });
            } else if (paused._modalType === 'divineFury') {
                setModalState({ divineFuryChoice: paused._modalProps });
                setPendingDamage({
                    attack: paused.attack,
                    formula: paused.formula,
                    total: paused.total,
                    rolls: paused.rolls,
                    modifier: paused.modifier,
                    bonusExpr: paused.bonusExpr,
                    bonusTotal: paused.bonusTotal,
                    bonusRolls: paused.bonusRolls,
                });
            } else if (paused._modalType === 'secondaryTarget') {
                setModalState({ secondaryTargetModal: paused._modalProps });
            } else if (paused._modalType === 'tacticalMaster') {
                setRuntimeObject(campaignName, { tacticalMasterPending: paused._modalProps }, campaignName, true);
            }
        }
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

                setModalState({ attackRiderManeuverPrompt: null });
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
            if (result?.type === 'modal' && result.modalName === 'attackRiderOptions') {
                setModalState({ attackRiderOptionsModal: result.payload });
                return { formula: updatedFormula, total: updatedTotal, rolls: updatedRolls, pendingOptions: true };
            }

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

            setModalState({ attackRiderManeuverPrompt: null });
            if (result?.type === 'popup') {
                setPopupHtml(result.payload);
            }
            if (result?.type === 'modal' && result.modalName === 'sweepingAttackTarget') {
                setModalState({ sweepingAttackTargetModal: result.payload });
            }
        }

        return { formula: updatedFormula, total: updatedTotal, rolls: updatedRolls };
    };

    const handleAttackRiderManeuverSkip = () => {
        setModalState({ attackRiderManeuverPrompt: null });
    };

    const handleAttackRiderOptionSelect = async (optionName, modalPayload) => {
        const { maneuver, targetName, description } = modalPayload;
        setModalState({ attackRiderOptionsModal: null });

        // Set brutal strike flags for damage step processing
        await setRuntimeValue(playerStats.name, '_brutalStrikeActive', true, campaignName);
        await setRuntimeValue(playerStats.name, '_brutalStrikeEffects', [optionName], campaignName);

        // Apply immediate effects (push, speed reduction, etc.)
        const option = maneuver.automation.options.find(o => o.name === optionName);
        let logDescription = description;
        if (option) {
            if (option.effect === 'push_15ft' && targetName) {
                const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                const newEffect = {
                    target: targetName,
                    source: playerStats.name,
                    option: optionName,
                    effect: 'push',
                    value: 15,
                    duration: 'instant',
                };
                setRuntimeValue(campaignName, 'targetEffects', [...storedEffects, newEffect], campaignName);
                logDescription += ` ${targetName} pushed 15 feet.`;
            } else if (option.effect === 'speed_reduction' && targetName) {
                const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                const newEffect = {
                    target: targetName,
                    source: playerStats.name,
                    option: optionName,
                    effect: 'speed_reduction',
                    value: option.value || '15_ft_until_start_of_next_turn',
                    duration: 'until_start_of_next_turn',
                };
                setRuntimeValue(campaignName, 'targetEffects', [...storedEffects, newEffect], campaignName);
                logDescription += ` ${targetName}'s speed reduced by 15 feet.`;
            }
        }

        setPopupHtml({ type: 'automation_info', name: maneuver.name, description: `${logDescription} Selected: ${optionName}.` });
    };

    return { resolveAttackDamage, proceedWithDamage, handleAttackRiderManeuverUse, handleAttackRiderManeuverSkip, handleAttackRiderOptionSelect };
}
