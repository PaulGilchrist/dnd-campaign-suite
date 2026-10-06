import React, { useState, useCallback, useRef } from 'react';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';
import CreatureSelectionModal from './CreatureSelectionModal.jsx';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';
import { logConditionApplied, logSaveResultEntry } from './saveResultLogging.js';
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

function HypnoticPatternModal({
    action,
    playerStats,
    campaignName,
    saveType,
    saveDc,
    activeOverlay,
    metamagicCareful,
    metamagicHeighten,
    onClose,
}) {
    const [pendingPrompts, setPendingPrompts] = useState([]);
    usePendingPromptsCleanup(setPendingPrompts);

    // SP-069: CLA-101 re-entry latch — the spell slot is paid once upstream by
    // gateMetamagic → prepareSpellCast; a repeated confirm click here must never
    // re-run the save lane (sp-roll-btn stayed clickable while PC prompts pended).
    const confirmStartedRef = useRef(false);

    const [heightenTarget, setHeightenTarget] = useState(null);

    const { isCarefulSpell, isCarefulAlly } = useCarefulSpellSelection(metamagicCareful, playerStats.name);

    const applyHypnoticConditionsToTarget = useCallback((targetName, campaignName) => {
        const storedConditions = getRuntimeValue(targetName, 'activeConditions') || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const filtered = conditions.filter(c =>
            String(c).toLowerCase() !== 'charmed' &&
            String(c).toLowerCase() !== 'incapacitated' &&
            String(c).toLowerCase() !== 'speed_zero'
        );
        setRuntimeValue(targetName, 'activeConditions', [...filtered, 'charmed', 'incapacitated', 'speed_zero'], campaignName);
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
                    results.push(await resolveNpcCarefulSave(campaignName, { casterName, targetName, saveDc, saveType, roll: save.saveRoll, total: save.saveTotal, saveBonus: save.saveBonus, logPrefix: '[HypnoticPatternModal]' }));
                } else if (!save.success) {
                    results.push(await resolveNpcSaveFailure(campaignName, {
                        casterName,
                        targetName,
                        saveDc,
                        saveType,
                        roll: save.saveRoll,
                        total: save.saveTotal,
                        saveBonus: save.saveBonus,
                        logPrefix: '[HypnoticPatternModal]',
                        applyConditions: (targetName, campaignName) => {
                            applyHypnoticConditionsToTarget(targetName, campaignName);
                            addExpiration({ attackerName: casterName, targetName, effects: [
                                { type: 'charmed', condition: 'charmed' },
                                { type: 'incapacitated', condition: 'incapacitated' },
                                { type: 'speed_zero', condition: 'speed_zero' },
                            ], campaignName });
                        },
                        conditionNames: ['Charmed', 'Incapacitated', 'Speed 0'],
                        failSummary: {
                            condition: 'Charmed, Incapacitated, Speed 0',
                            reason: 'Hypnotic Pattern spell',
                            note: `${targetName} is Charmed, Incapacitated, and has Speed 0. The spell ends if the creature takes damage or someone uses an action to shake it free.`,
                        },
                        conditions: ['charmed', 'incapacitated', 'speed_zero'],
                    }));
                } else {
                    results.push(await resolveNpcSaveSuccess(campaignName, { casterName, targetName, saveDc, saveType, roll: save.saveRoll, total: save.saveTotal, saveBonus: save.saveBonus, logPrefix: '[HypnoticPatternModal]' }));
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
    }, [campaignName, playerStats.name, action.name, saveDc, saveType, isCarefulSpell, isCarefulAlly, heightenTarget, applyHypnoticConditionsToTarget]);

    const handleSaveResult = useCallback(async (event) => {
        const detail = event.detail;
        if (!detail || !detail.promptId) return;

        const pendingIndex = pendingPrompts.findIndex(p => p.promptId === detail.promptId);
        if (pendingIndex === -1) return;

        const targetName = pendingPrompts[pendingIndex].targetName;
        const success = detail.success;
        const casterName = playerStats.name;

        if (!success) {
            applyHypnoticConditionsToTarget(targetName, campaignName);
            addExpiration({ attackerName: casterName, targetName, effects: [
                { type: 'charmed', condition: 'charmed' },
                { type: 'incapacitated', condition: 'incapacitated' },
                { type: 'speed_zero', condition: 'speed_zero' },
            ], campaignName });

            await logConditionApplied(campaignName, {
                targetName,
                condition: 'Charmed, Incapacitated, Speed 0',
                reason: 'Hypnotic Pattern spell',
                note: `${targetName} is Charmed, Incapacitated, and has Speed 0. The spell ends if the creature takes damage or someone uses an action to shake it free.`,
                logPrefix: '[HypnoticPatternModal]',
            });

            await logSaveResultEntry(campaignName, { casterName, targetName, saveDc, saveType, success: false, detail, logPrefix: '[HypnoticPatternModal]' });

            addTargetResult(campaignName, {
                targetName,
                saveResult: 'failure',
                roll: detail.roll ?? 0,
                total: detail.total ?? 0,
                conditions: ['charmed', 'incapacitated', 'speed_zero'],
                appliedDamage: 0,
            });
        } else {
            await logSaveResultEntry(campaignName, { casterName, targetName, saveDc, saveType, success: true, detail, logPrefix: '[HypnoticPatternModal]' });

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
    }, [campaignName, saveDc, saveType, pendingPrompts, applyHypnoticConditionsToTarget, playerStats.name, onClose]);

    useSaveResultListener(pendingPrompts, handleSaveResult);

    const combatSummary = getCombatSummary(campaignName);
    const isOverlayTargeted = playerStats.targetName?.startsWith('overlay-');

    const eligibleTargets = useCarefulEligibleTargets(combatSummary, isCarefulSpell, isCarefulAlly);

    const getCreatureTargets = () => {
        return mapCreatureTargets(eligibleTargets);
    };

    const handleCreatureSelectionConfirm = useCallback(async (selectedNames) => {
        if (confirmStartedRef.current) return;
        confirmStartedRef.current = true;

        await logAbilityUseSelection(campaignName, { casterName: playerStats.name, abilityName: action.name, targetCount: selectedNames.length, saveDc, saveType, logPrefix: '[HypnoticPatternModal]' });

        const { prompts } = await resolveAllSaves(selectedNames);
        setPendingPrompts(prompts);
    }, [campaignName, playerStats.name, action.name, saveDc, saveType, resolveAllSaves]);

    const handleCreatureSelectionSkip = useCallback(() => {
        onClose();
    }, [onClose]);

    if (isOverlayTargeted && activeOverlay) {
        return (
            <React.Fragment>
                {/* Overlay targeting not implemented for Hypnotic Pattern - fall back to CreatureSelectionModal */}
            </React.Fragment>
        );
    }

    return (
        <CreatureSelectionModal
            title={action.name}
            icon="fa-eye"
            targets={getCreatureTargets()}
            description={`Select creatures in the 30-foot Cube. Each must make a <strong>${saveType}</strong> saving throw (DC ${saveDc}).`}
            note={`On a failed save, target becomes <strong>Charmed</strong>, <strong>Incapacitated</strong>, and has <strong>Speed 0</strong>. The spell ends if the creature takes damage or someone uses an action to shake it free.${metamagicHeighten ? ' Heightened Spell: one target will have disadvantage.' : ''}`}
            confirmLabel={action.name}
            confirmIcon="fa-eye"
            onConfirm={handleCreatureSelectionConfirm}
            onSkip={handleCreatureSelectionSkip}
            metamagicHeighten={metamagicHeighten}
            heightenTarget={heightenTarget}
            setHeightenTarget={setHeightenTarget}
        />
    );
}

export default HypnoticPatternModal;
