import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { storeSpellLastAttack, addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';
import CreatureSelectionModal from './CreatureSelectionModal.jsx';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';

function buildLaughterConditionEntry(targetName, actionName) {
    return {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Prone, Incapacitated',
        reason: actionName,
        note: `${targetName} is Prone and Incapacitated by Tasha's Hideous Laughter. The target can't end the Prone condition on itself.`,
        timestamp: Date.now(),
    };
}

function buildLaughterSaveResultEntry({ casterName, targetName, saveDc, saveType, success, detail }) {
    return {
        type: 'save_result',
        characterName: casterName,
        targetName,
        saveDc: saveDc,
        saveType,
        success,
        roll: detail.roll ?? 0,
        total: detail.total ?? 0,
        saveBonus: detail.saveBonus ?? 0,
        description: `${targetName} ${success ? 'succeeded on' : 'failed'} ${saveType} save (DC ${saveDc}, rolled ${detail.roll ?? 0}${detail.saveBonus !== 0 ? ' + ' + detail.saveBonus : ''} = ${detail.total ?? 0})${success ? '' : ' and is Prone and Incapacitated.'}`,
        timestamp: Date.now(),
    };
}

function buildLaughterTargetResult(targetName, success, detail) {
    return {
        targetName,
        saveResult: success ? 'success' : 'failure',
        roll: detail.roll ?? 0,
        total: detail.total ?? 0,
        conditions: success ? [] : ['prone', 'incapacitated'],
        appliedDamage: 0,
    };
}

function finishLaughterResolution(allResults, actionName, onClose, setPopupHtml) {
    const failedResults = allResults.filter(r => !r.success);
    const savedCount = allResults.filter(r => r.success).length;
    if (failedResults.length > 0) {
        const failedNames = failedResults.map(r => r.targetName).join(', ');
        const popupDesc = `${failedResults.length} creature(s) failed their save and are Prone and Incapacitated: ${failedNames}. ${savedCount} creature(s) saved.`;
        if (setPopupHtml) {
            setTimeout(() => {
                setPopupHtml({
                    type: 'automation_info',
                    name: actionName,
                    description: popupDesc,
                });
            }, 0);
        }
    }
    setTimeout(() => onClose(), 500);
}

function TashasLaughterModal({
    action,
    playerStats,
    campaignName,
    saveType,
    saveDc,
    spellSlotLevel,
    metamagicHeighten,
    onClose,
    setPopupHtml,
}) {
    const [pendingPrompts, setPendingPrompts] = useState([]);
    const [heightenTarget, setHeightenTarget] = useState(null);
    const allResultsRef = useRef([]);

    useEffect(() => {
        return () => {
            setPendingPrompts([]);
        };
    }, []);

    const maxTargets = Math.max(1, spellSlotLevel);

    const applyLaughterConditionsToTarget = useCallback((targetName, campaignName, dc, casterName) => {
        const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const filtered = conditions.filter(c =>
            String(c).toLowerCase() !== 'prone' &&
            String(c).toLowerCase() !== 'incapacitated'
        );
        setRuntimeValue(targetName, 'activeConditions', [...filtered, 'prone', 'incapacitated'], campaignName);

        const existingMeta = getRuntimeValue(targetName, 'activeConditionMeta', campaignName) || {};
        setRuntimeValue(targetName, 'activeConditionMeta', {
            ...existingMeta,
            prone: {
                ...(existingMeta.prone || {}),
                dc,
                ability: 'wis',
            },
            incapacitated: {
                ...(existingMeta.incapacitated || {}),
                dc,
                ability: 'wis',
            },
        }, campaignName);

        addExpiration(casterName, targetName, [
            { type: 'condition', condition: 'prone' },
            { type: 'condition', condition: 'incapacitated' },
            { type: 'tashas_laughter_expiration' },
        ], campaignName);

        const allTargetEffects = [...getRuntimeValue('campaign', 'targetEffects') || []];
        const existingIndex = allTargetEffects.findIndex(
            te => te.target === targetName && te.effect === 'tashas_hideous_laughter' && te.source === casterName
        );
        const laughterEffect = {
            target: targetName,
            effect: 'tashas_hideous_laughter',
            source: casterName,
            dc,
            duration: 'concentration',
            conditions: ['prone', 'incapacitated'],
        };
        if (existingIndex >= 0) {
            allTargetEffects[existingIndex] = laughterEffect;
        } else {
            allTargetEffects.push(laughterEffect);
        }
        setRuntimeValue('campaign', 'targetEffects', allTargetEffects, campaignName);
    }, []);

    const resolveAllSaves = useCallback(async (selectedNames) => {
        const combatSummary = getCombatSummary(campaignName);
        if (!combatSummary) return { results: [], prompts: [] };

        const results = [];
        const prompts = [];
        const casterName = playerStats.name;

        storeSpellLastAttack(campaignName, {
            casterName,
            spellName: action.name,
            saveType,
            saveDc: saveDc,
            attackScope: 'single',
        });

        for (const targetName of selectedNames) {
            const target = combatSummary.creatures.find(c => c.name === targetName);
            if (!target) continue;

            const isNpc = target.type === 'npc';
            const saveBonus = target?.saveBonuses?.[saveType.toLowerCase()] ?? 0;
            const isHeightenTarget = heightenTarget === targetName;
            const disadvantage = isHeightenTarget;

            if (isNpc) {
                const saveRoll = disadvantage
                    ? Math.min(Math.floor(Math.random() * 20) + 1, Math.floor(Math.random() * 20) + 1)
                    : Math.floor(Math.random() * 20) + 1;
                const saveTotal = saveRoll + saveBonus;
                const success = saveTotal >= saveDc;

                if (success) {
                    await addEntry(campaignName, {
                        type: 'save_result',
                        characterName: casterName,
                        targetName,
                        saveDc: saveDc,
                        saveType,
                        success: true,
                        roll: saveRoll,
                        total: saveTotal,
                        saveBonus,
                        description: `${targetName} succeeded on ${saveType} save (DC ${saveDc}, rolled ${saveRoll} + ${saveBonus} = ${saveTotal})`,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error('[TashasLaughterModal] Error logging save result:', e); });

                    addTargetResult(campaignName, {
                        targetName,
                        saveResult: 'success',
                        roll: saveRoll,
                        total: saveTotal,
                        conditions: [],
                        appliedDamage: 0,
                    });

                    results.push({ targetName, success: true, roll: saveRoll, total: saveTotal, saveBonus, conditionApplied: false });
                } else {
                    applyLaughterConditionsToTarget(targetName, campaignName, saveDc, casterName);

                    await addEntry(campaignName, {
                        type: 'condition',
                        action: 'applied',
                        characterName: targetName,
                        condition: 'Prone, Incapacitated',
                        reason: action.name,
                        note: `${targetName} is Prone and Incapacitated by Tasha's Hideous Laughter. The target can't end the Prone condition on itself.`,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error('[TashasLaughterModal] Error logging condition:', e); });

                    await addEntry(campaignName, {
                        type: 'save_result',
                        characterName: casterName,
                        targetName,
                        saveDc: saveDc,
                        saveType,
                        success: false,
                        roll: saveRoll,
                        total: saveTotal,
                        saveBonus,
                        description: `${targetName} failed ${saveType} save (DC ${saveDc}, rolled ${saveRoll} + ${saveBonus} = ${saveTotal}) and is Prone and Incapacitated.`,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error('[TashasLaughterModal] Error logging save result:', e); });

                    addTargetResult(campaignName, {
                        targetName,
                        saveResult: 'failure',
                        roll: saveRoll,
                        total: saveTotal,
                        conditions: ['prone', 'incapacitated'],
                        appliedDamage: 0,
                    });

                    results.push({ targetName, success: false, roll: saveRoll, total: saveTotal, saveBonus, conditionApplied: true });
                }
            } else {
                const promptId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

                sendSavePrompt(campaignName, {
                    promptId,
                    targetName,
                    saveType: saveType,
                    saveDc: saveDc,
                    sourceName: casterName,
                    disadvantage,
                });

                const existingPrompts = Array.from(getRuntimeValue('campaign', 'pendingSaveListenerPrompts') || []);
                existingPrompts.push(promptId);
                setRuntimeValue('campaign', 'pendingSaveListenerPrompts', existingPrompts, campaignName);

                prompts.push({ promptId, targetName });
            }
        }

        persistAndNotify(getCombatSummary(campaignName), campaignName);

        return { results, prompts };
    }, [campaignName, playerStats.name, action.name, saveDc, saveType, heightenTarget, applyLaughterConditionsToTarget]);

    const handleSaveResult = useCallback(async (event) => {
        const detail = event.detail;
        if (!detail || !detail.promptId) return;

        const pendingIndex = pendingPrompts.findIndex(p => p.promptId === detail.promptId);
        if (pendingIndex === -1) return;

        const targetName = pendingPrompts[pendingIndex].targetName;
        const success = detail.success;
        const casterName = playerStats.name;

        if (!success) {
            applyLaughterConditionsToTarget(targetName, campaignName, saveDc, casterName);
            await addEntry(campaignName, buildLaughterConditionEntry(targetName, action.name)).catch((e) => { console.error('[TashasLaughterModal] Error logging condition:', e); });
        }
        await addEntry(campaignName, buildLaughterSaveResultEntry({ casterName, targetName, saveDc, saveType, success, detail })).catch((e) => { console.error('[TashasLaughterModal] Error logging save result:', e); });
        addTargetResult(campaignName, buildLaughterTargetResult(targetName, success, detail));

        persistAndNotify(getCombatSummary(campaignName), campaignName);

        allResultsRef.current = [...allResultsRef.current, {
            targetName,
            success,
            roll: detail.roll ?? 0,
            total: detail.total ?? 0,
            saveBonus: detail.saveBonus ?? 0,
            conditionApplied: !success,
        }];

        setPendingPrompts(prompts => {
            const updated = prompts.filter(p => p.promptId !== detail.promptId);
            if (updated.length === 0) {
                finishLaughterResolution(allResultsRef.current, action.name, onClose, setPopupHtml);
            }
            return updated;
        });
    }, [campaignName, saveDc, saveType, pendingPrompts, applyLaughterConditionsToTarget, playerStats.name, action.name, onClose, setPopupHtml]);

    useEffect(() => {
        if (pendingPrompts.length === 0) return;
        const handleSaveEvent = (event) => {
            handleSaveResult(event);
        };
        window.addEventListener('save-result', handleSaveEvent);
        return () => window.removeEventListener('save-result', handleSaveEvent);
    }, [pendingPrompts.length, handleSaveResult]);

    const combatSummary = getCombatSummary(campaignName);

    const eligibleTargets = useMemo(() => {
        if (!combatSummary?.creatures) return [];
        return combatSummary.creatures;
    }, [combatSummary]);

    const getCreatureTargets = () => {
        return eligibleTargets.map(c => ({
            name: c.name,
            type: c.type,
            currentHp: c.currentHp,
            maxHp: c.maxHp,
        }));
    };

    const handleCreatureSelectionConfirm = useCallback(async (selectedNames) => {
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            description: `${action.name}: Selecting ${selectedNames.length} target(s) for save (DC ${saveDc} ${saveType})`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[TashasLaughterModal] Error logging feature use:', e); });

        const { results, prompts } = await resolveAllSaves(selectedNames);
        allResultsRef.current = results;
        setPendingPrompts(prompts);

        if (prompts.length === 0) {
            const failedResults = results.filter(r => !r.success);
            const savedCount = results.filter(r => r.success).length;
            if (failedResults.length > 0) {
                const failedNames = failedResults.map(r => r.targetName).join(', ');
                const popupDesc = `${failedResults.length} creature(s) failed their save and are Prone and Incapacitated: ${failedNames}. ${savedCount} creature(s) saved.`;
                if (setPopupHtml) {
                    setTimeout(() => {
                        setPopupHtml({
                            type: 'automation_info',
                            name: action.name,
                            description: popupDesc,
                        });
                    }, 0);
                }
            }
            setTimeout(() => onClose(), 500);
        }
    }, [campaignName, playerStats.name, action.name, saveDc, saveType, resolveAllSaves, setPopupHtml, onClose]);

    const handleCreatureSelectionSkip = useCallback(() => {
        onClose();
    }, [onClose]);

    return (
        <CreatureSelectionModal
            title={action.name}
            icon="fa-music"
            targets={getCreatureTargets()}
            maxTargets={maxTargets}
            description={`Select up to ${maxTargets} creature(s) within range. Each must make a <strong>${saveType}</strong> saving throw (DC ${saveDc}).`}
            note={`On a failed save, target becomes <strong>Prone</strong> and <strong>Incapacitated</strong>. The target can't end the Prone condition on itself. Concentration, up to 1 minute.${metamagicHeighten ? ' Heightened Spell: one target will have disadvantage.' : ''}`}
            confirmLabel={action.name}
            confirmIcon="fa-music"
            onConfirm={handleCreatureSelectionConfirm}
            onSkip={handleCreatureSelectionSkip}
            metamagicHeighten={metamagicHeighten}
            heightenTarget={heightenTarget}
            setHeightenTarget={setHeightenTarget}
        />
    );
}

export default TashasLaughterModal;
