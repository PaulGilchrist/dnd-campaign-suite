import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { storeSpellLastAttack, addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';
import CreatureSelectionModal from './CreatureSelectionModal.jsx';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';
import { logConditionApplied, logSaveResultEntry } from './saveResultLogging.js';

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

    useEffect(() => {
        return () => {
            setPendingPrompts([]);
        };
    }, []);

    const [heightenTarget, setHeightenTarget] = useState(null);

    const isCarefulSpell = metamagicCareful || false;
    const allyList = isCarefulSpell ? getAllyList(playerStats.name) : null;
    const isCarefulAlly = useCallback((name) => allyList ? allyList.includes(name) : false, [allyList]);

    useEffect(() => {
        return () => {
            setPendingPrompts([]);
        };
    }, []);

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
        const combatSummary = getCombatSummary(campaignName);
        if (!combatSummary) return { results: [], prompts: [] };

        const results = [];
        const prompts = [];
        const casterName = playerStats.name;

        storeSpellLastAttack(campaignName, {
            casterName,
            spellName: action.name,
            saveType,
            saveDc,
            attackScope: 'aoe',
        });

        for (const targetName of selectedNames) {
            const target = combatSummary.creatures.find(c => c.name === targetName);
            if (!target) continue;

            const isNpc = target.type === 'npc';
            const saveBonus = target?.saveBonuses?.[saveType.toLowerCase()] ?? 0;

            if (isNpc) {
                const carefulSpellProtected = isCarefulSpell && isCarefulAlly(targetName);
                const isHeightenTarget = heightenTarget === targetName;

                const saveRoll = isHeightenTarget ? Math.min(Math.floor(Math.random() * 20) + 1, Math.floor(Math.random() * 20) + 1) : Math.floor(Math.random() * 20) + 1;
                const saveTotal = saveRoll + saveBonus;
                const success = saveTotal >= saveDc;

                if (carefulSpellProtected) {
                    await addEntry(campaignName, {
                        type: 'save_result',
                        characterName: casterName,
                        targetName,
                        saveDc,
                        saveType,
                        success: true,
                        roll: saveRoll,
                        total: saveTotal,
                        saveBonus,
                        description: `${targetName} succeeded on ${saveType} save (DC ${saveDc}, rolled ${saveRoll} + ${saveBonus} = ${saveTotal}) — Careful Spell protected`,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error('[HypnoticPatternModal] Error logging save result:', e); });
                    addTargetResult(campaignName, {
                        targetName,
                        saveResult: 'success',
                        roll: saveRoll,
                        total: saveTotal,
                        conditions: [],
                        appliedDamage: 0,
                    });
                    results.push({
                        targetName,
                        success: true,
                        roll: saveRoll,
                        total: saveTotal,
                        saveBonus,
                        conditionApplied: false,
                    });
                } else if (!success) {
                    applyHypnoticConditionsToTarget(targetName, campaignName);
                    addExpiration(casterName, targetName, [
                        { type: 'charmed', condition: 'charmed' },
                        { type: 'incapacitated', condition: 'incapacitated' },
                        { type: 'speed_zero', condition: 'speed_zero' },
                    ], campaignName);

                    await addEntry(campaignName, {
                        type: 'condition',
                        action: 'applied',
                        characterName: targetName,
                        condition: 'Charmed',
                        dc: saveDc,
                        ability: saveType,
                        sourceName: casterName,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error('[HypnoticPatternModal] Error logging condition:', e); });

                    await addEntry(campaignName, {
                        type: 'condition',
                        action: 'applied',
                        characterName: targetName,
                        condition: 'Incapacitated',
                        dc: saveDc,
                        ability: saveType,
                        sourceName: casterName,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error('[HypnoticPatternModal] Error logging condition:', e); });

                    await addEntry(campaignName, {
                        type: 'condition',
                        action: 'applied',
                        characterName: targetName,
                        condition: 'Speed 0',
                        dc: saveDc,
                        ability: saveType,
                        sourceName: casterName,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error('[HypnoticPatternModal] Error logging condition:', e); });

                    await addEntry(campaignName, {
                        type: 'save_result',
                        characterName: casterName,
                        targetName,
                        saveDc,
                        saveType,
                        success: false,
                        roll: saveRoll,
                        total: saveTotal,
                        saveBonus,
                        description: `${targetName} failed ${saveType} save (DC ${saveDc}, rolled ${saveRoll} + ${saveBonus} = ${saveTotal})`,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error('[HypnoticPatternModal] Error logging save result:', e); });

                    await addEntry(campaignName, {
                        type: 'condition',
                        action: 'applied',
                        characterName: targetName,
                        condition: 'Charmed, Incapacitated, Speed 0',
                        reason: 'Hypnotic Pattern spell',
                        note: `${targetName} is Charmed, Incapacitated, and has Speed 0. The spell ends if the creature takes damage or someone uses an action to shake it free.`,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error('[HypnoticPatternModal] Error logging condition:', e); });

                    addTargetResult(campaignName, {
                        targetName,
                        saveResult: 'failure',
                        roll: saveRoll,
                        total: saveTotal,
                        conditions: ['charmed', 'incapacitated', 'speed_zero'],
                        appliedDamage: 0,
                    });

                    results.push({
                        targetName,
                        success: false,
                        roll: saveRoll,
                        total: saveTotal,
                        saveBonus,
                        conditionApplied: true,
                    });
                } else {
                    results.push({
                        targetName,
                        success: true,
                        roll: saveRoll,
                        total: saveTotal,
                        saveBonus,
                        conditionApplied: false,
                    });

                    await addEntry(campaignName, {
                        type: 'save_result',
                        characterName: casterName,
                        targetName,
                        saveDc,
                        saveType,
                        success: true,
                        roll: saveRoll,
                        total: saveTotal,
                        saveBonus,
                        description: `${targetName} succeeded on ${saveType} save (DC ${saveDc}, rolled ${saveRoll} + ${saveBonus} = ${saveTotal})`,
                        timestamp: Date.now(),
                    }).catch((e) => { console.error('[HypnoticPatternModal] Error logging save result:', e); });

                    addTargetResult(campaignName, {
                        targetName,
                        saveResult: 'success',
                        roll: saveRoll,
                        total: saveTotal,
                        conditions: [],
                        appliedDamage: 0,
                    });
                }
            } else {
                const carefulSpellProtected = isCarefulSpell && isCarefulAlly(targetName);

                if (carefulSpellProtected) {
                    results.push({
                        targetName,
                        success: true,
                        roll: null,
                        total: 0,
                        saveBonus: 0,
                        conditionApplied: false,
                    });
                } else {
                    const promptId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

                    sendSavePrompt(campaignName, {
                        promptId,
                        targetName,
                        saveType: saveType,
                        saveDc: saveDc,
                        sourceName: casterName,
                    });

                    const existingPrompts = Array.from(getRuntimeValue('campaign', 'pendingSaveListenerPrompts') || []);
                    existingPrompts.push(promptId);
                    setRuntimeValue('campaign', 'pendingSaveListenerPrompts', existingPrompts, campaignName);

                    prompts.push({ promptId, targetName });
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
            addExpiration(casterName, targetName, [
                { type: 'charmed', condition: 'charmed' },
                { type: 'incapacitated', condition: 'incapacitated' },
                { type: 'speed_zero', condition: 'speed_zero' },
            ], campaignName);

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

        setPendingPrompts(prev => {
            const updated = prev.filter(p => p.promptId !== detail.promptId);
            if (updated.length === 0) {
                setTimeout(() => onClose(), 500);
            }
            return updated;
        });
    }, [campaignName, saveDc, saveType, pendingPrompts, applyHypnoticConditionsToTarget, playerStats.name, onClose]);

    useEffect(() => {
        if (pendingPrompts.length === 0) return;
        const handleSaveEvent = (event) => {
            handleSaveResult(event);
        };
        window.addEventListener('save-result', handleSaveEvent);
        return () => window.removeEventListener('save-result', handleSaveEvent);
    }, [pendingPrompts.length, handleSaveResult]);

    const combatSummary = getCombatSummary(campaignName);
    const isOverlayTargeted = playerStats.targetName?.startsWith('overlay-');

    const eligibleTargets = useMemo(() => {
        if (!combatSummary?.creatures) return [];
        return combatSummary.creatures
            .map(c => ({
                ...c,
                carefulSpellProtected: isCarefulSpell && isCarefulAlly(c.name),
            }));
    }, [combatSummary, isCarefulSpell, isCarefulAlly]);

    const getCreatureTargets = () => {
        return eligibleTargets.map(c => ({
            name: c.name,
            type: c.type,
            currentHp: c.currentHp,
            maxHp: c.maxHp,
            carefulSpellProtected: c.carefulSpellProtected,
        }));
    };

    const handleCreatureSelectionConfirm = useCallback(async (selectedNames) => {
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            description: `${action.name}: Selecting ${selectedNames.length} target(s) for save (DC ${saveDc} ${saveType})`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[HypnoticPatternModal] Error logging feature use:', e); });

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
            description={`Select creatures in the 20-foot-radius sphere. Each must make a <strong>${saveType}</strong> saving throw (DC ${saveDc}).`}
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
