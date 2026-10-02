import React, { useState, useCallback } from 'react';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';
import CreatureSelectionModal from './CreatureSelectionModal.jsx';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';
import { logConditionApplied, logSaveResultEntry } from './saveResultLogging.js';
import { getAuraConditionImmunities, auraCoversCondition, logAuraConditionImmunity } from '../../../../services/combat/auras/auraConditionImmunity.js';

// CLA-019: Aura of Courage — Frightened is SUPPRESSED (save still fails, condition
// never lands) for the aura host and allies in range. Membership/range gating rides
// computeAuraComboEffects — the same verified model applyDamage uses for resistances.
async function resolveFearImmunityLeg(campaignName, { casterName, targetName, saveDc, saveType, detail, auraImmunities, actionName }) {
    logAuraConditionImmunity({ campaignName, targetName, conditionKey: 'frightened', auraImmunities, sourceAbility: actionName });
    await logSaveResultEntry(campaignName, { casterName, targetName, saveDc, saveType, success: false, detail, logPrefix: '[FearModal]' });
    addTargetResult(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: detail.roll ?? 0,
        total: detail.total ?? 0,
        conditions: [],
        appliedDamage: 0,
    });
    return { targetName, success: false, roll: detail.roll, total: detail.total, saveBonus: detail.saveBonus ?? 0, conditionApplied: false };
}
import {
    useCarefulSpellSelection,
    usePendingPromptsCleanup,
    useSaveResultListener,
    useCarefulEligibleTargets,
    mapCreatureTargets,
    rollNpcSave,
    buildCarefulPlayerSaveResult,
    issuePlayerSavePrompt,
    logAbilityUseSelection,
    resolveAllSavesPreamble,
    resolveNpcCarefulSave,
    resolveNpcSaveSuccess,
    resolveNpcSaveFailure,
    dropPendingPrompt,
} from './AreaEffectSaveFlow.utils.js';

function FearModal({
    action,
    playerStats,
    campaignName,
    saveType,
    saveDc,
    activeOverlay,
    metamagicCareful,
    metamagicHeighten,
    onClose,
    characters = [],
}) {
    const [pendingPrompts, setPendingPrompts] = useState([]);
    usePendingPromptsCleanup(setPendingPrompts);

    const [heightenTarget, setHeightenTarget] = useState(null);

    const { isCarefulSpell, isCarefulAlly } = useCarefulSpellSelection(metamagicCareful, playerStats.name);

    const applyFrightenedToTarget = useCallback((targetName, campaignName) => {
        const storedConditions = getRuntimeValue(targetName, 'activeConditions') || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const filtered = conditions.filter(c => String(c).toLowerCase() !== 'frightened');
        setRuntimeValue(targetName, 'activeConditions', [...filtered, 'frightened'], campaignName);
    }, []);

    const trackFearEffect = useCallback((casterName, targetName, dc, campaignName) => {
        const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
        const effects = Array.isArray(targetEffects) ? targetEffects : [];
        const existingIdx = effects.findIndex(
            te => te.target === targetName && te.effect === 'fear_end_on_los'
        );
        const fearEffect = {
            target: targetName,
            effect: 'fear_end_on_los',
            source: casterName,
            condition: 'frightened',
            dc: dc,
            duration: 'concentration',
        };
        if (existingIdx >= 0) {
            effects[existingIdx] = fearEffect;
        } else {
            effects.push(fearEffect);
        }
        setRuntimeValue('campaign', 'targetEffects', effects, campaignName);
    }, []);

    const resolveAllSaves = useCallback(async (selectedNames) => {
        const casterName = playerStats.name;
        const combatSummary = getCombatSummary(campaignName);

        const state = resolveAllSavesPreamble(campaignName, { casterName, spellName: action.name, saveType, saveDc, combatSummary });
        if (!state) return { results: [], prompts: [] };
        const { results, prompts } = state;

        for (const targetName of selectedNames) {
            const target = combatSummary.creatures.find(c => c.name === targetName);
            if (!target) continue;

            const isNpc = target.type === 'npc';

            if (isNpc) {
                const carefulSpellProtected = isCarefulSpell && isCarefulAlly(targetName);
                const save = rollNpcSave(target, saveType, saveDc, heightenTarget === targetName);

                if (carefulSpellProtected) {
                    results.push(await resolveNpcCarefulSave(campaignName, { casterName, targetName, saveDc, saveType, roll: save.saveRoll, total: save.saveTotal, saveBonus: save.saveBonus, logPrefix: '[FearModal]' }));
                } else if (!save.success) {
                    const auraImmunities = await getAuraConditionImmunities({ targetName, characters });
                    if (auraCoversCondition(auraImmunities, 'frightened')) {
                        results.push(await resolveFearImmunityLeg(campaignName, { casterName, targetName, saveDc, saveType, detail: { roll: save.saveRoll, total: save.saveTotal, saveBonus: save.saveBonus }, auraImmunities, actionName: action.name }));
                    } else {
                        results.push(await resolveNpcSaveFailure(campaignName, {
                            casterName,
                            targetName,
                            saveDc,
                            saveType,
                            roll: save.saveRoll,
                            total: save.saveTotal,
                            saveBonus: save.saveBonus,
                            logPrefix: '[FearModal]',
                            applyConditions: (targetName, campaignName) => {
                                applyFrightenedToTarget(targetName, campaignName);
                                addExpiration({ attackerName: casterName, targetName, effects: [{ type: 'condition', condition: 'frightened' }], campaignName });
                                trackFearEffect(casterName, targetName, saveDc, campaignName);
                            },
                            conditionNames: ['Frightened'],
                            failSummary: {
                                condition: 'Frightened',
                                reason: 'Fear spell',
                                note: `${targetName} drops what it was holding, becomes Frightened, and must take the Dash action to move away from ${casterName} on each of its turns.`,
                            },
                            conditions: ['frightened'],
                        }));
                    }
                } else {
                    results.push(await resolveNpcSaveSuccess(campaignName, { casterName, targetName, saveDc, saveType, roll: save.saveRoll, total: save.saveTotal, saveBonus: save.saveBonus, logPrefix: '[FearModal]' }));
                }
            } else {
                const carefulSpellProtected = isCarefulSpell && isCarefulAlly(targetName);

                if (carefulSpellProtected) {
                    results.push(buildCarefulPlayerSaveResult(targetName));
                } else {
                    prompts.push(issuePlayerSavePrompt(campaignName, { targetName, saveType, saveDc, casterName }));
                }
            }
        }

        persistAndNotify(getCombatSummary(campaignName), campaignName);

        return { results, prompts };
    }, [campaignName, playerStats.name, action.name, saveDc, saveType, isCarefulSpell, isCarefulAlly, heightenTarget, applyFrightenedToTarget, trackFearEffect, characters]);

    const handleSaveResult = useCallback(async (event) => {
        const detail = event.detail;
        if (!detail || !detail.promptId) return;

        const pendingIndex = pendingPrompts.findIndex(p => p.promptId === detail.promptId);
        if (pendingIndex === -1) return;

        const targetName = pendingPrompts[pendingIndex].targetName;
        const success = detail.success;
        const casterName = playerStats.name;

        if (!success) {
            const auraImmunities = await getAuraConditionImmunities({ targetName, characters });
            if (auraCoversCondition(auraImmunities, 'frightened')) {
                await resolveFearImmunityLeg(campaignName, { casterName, targetName, saveDc, saveType, detail, auraImmunities, actionName: action.name });
            } else {
                applyFrightenedToTarget(targetName, campaignName);
                addExpiration({ attackerName: casterName, targetName, effects: [
                    { type: 'condition', condition: 'frightened' },
                ], campaignName });
                trackFearEffect(casterName, targetName, saveDc, campaignName);

                await logConditionApplied(campaignName, {
                    targetName,
                    condition: 'Frightened',
                    reason: 'Fear spell',
                    note: `${targetName} drops what it was holding, becomes Frightened, and must take the Dash action to move away from ${casterName} on each of its turns.`,
                    logPrefix: '[FearModal]',
                });

                await logSaveResultEntry(campaignName, { casterName, targetName, saveDc, saveType, success: false, detail, logPrefix: '[FearModal]' });

                addTargetResult(campaignName, {
                    targetName,
                    saveResult: 'failure',
                    roll: detail.roll ?? 0,
                    total: detail.total ?? 0,
                    conditions: ['frightened'],
                    appliedDamage: 0,
                });
            }
        } else {
            await logSaveResultEntry(campaignName, { casterName, targetName, saveDc, saveType, success: true, detail, logPrefix: '[FearModal]' });

            addTargetResult(campaignName, {
                targetName,
                saveResult: 'success',
                roll: detail.roll ?? 0,
                total: detail.total ?? 0,
                conditions: [],
                appliedDamage: 0,
            });
        }

        persistAndNotify(getCombatSummary(campaignName), campaignName);

        dropPendingPrompt(setPendingPrompts, detail.promptId, onClose);
    }, [campaignName, saveDc, saveType, pendingPrompts, applyFrightenedToTarget, trackFearEffect, playerStats.name, onClose, characters, action.name]);

    useSaveResultListener(pendingPrompts, handleSaveResult);

    const combatSummary = getCombatSummary(campaignName);
    const isOverlayTargeted = playerStats.targetName?.startsWith('overlay-');

    const eligibleTargets = useCarefulEligibleTargets(combatSummary, isCarefulSpell, isCarefulAlly);

    const getCreatureTargets = () => {
        return mapCreatureTargets(eligibleTargets);
    };

    const handleCreatureSelectionConfirm = useCallback(async (selectedNames) => {
        await logAbilityUseSelection(campaignName, { casterName: playerStats.name, abilityName: action.name, targetCount: selectedNames.length, saveDc, saveType, logPrefix: '[FearModal]' });

        const { prompts } = await resolveAllSaves(selectedNames);
        setPendingPrompts(prompts);
    }, [campaignName, playerStats.name, action.name, saveDc, saveType, resolveAllSaves]);

    const handleCreatureSelectionSkip = useCallback(() => {
        onClose();
    }, [onClose]);

    if (isOverlayTargeted && activeOverlay) {
        return (
            <React.Fragment>
                {/* Overlay targeting not implemented for Fear - fall back to CreatureSelectionModal */}
            </React.Fragment>
        );
    }

    return (
        <CreatureSelectionModal
            title={action.name}
            icon="fa-dice-d20"
            targets={getCreatureTargets()}
            description={`Select creatures in the 30-foot cone. Each must make a <strong>${saveType}</strong> saving throw (DC ${saveDc}).`}
            note={`On a failed save, target drops what it is holding and becomes <strong>Frightened</strong>. While frightened, it must take the Dash action to move away from you on each of its turns.${metamagicHeighten ? ' Heightened Spell: one target will have disadvantage.' : ''}`}
            confirmLabel={action.name}
            confirmIcon="fa-dice-d20"
            onConfirm={handleCreatureSelectionConfirm}
            onSkip={handleCreatureSelectionSkip}
            metamagicHeighten={metamagicHeighten}
            heightenTarget={heightenTarget}
            setHeightenTarget={setHeightenTarget}
        />
    );
}

export default FearModal;
