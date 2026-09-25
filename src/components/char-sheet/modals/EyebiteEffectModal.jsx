import React, { useState, useCallback, useEffect } from 'react';
import SecondaryTargetModal from './shared/SecondaryTargetModal.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../services/rules/effects/expirations.js';
import { rollD20 } from '../../../services/dice/diceRoller.js';
import { playerIsImmuneToCondition } from '../../../services/combat/automation/automationService.js';
import { sendSavePrompt, sendSaveResult } from '../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../services/ui/logService.js';
import { storeSpellLastAttack, addTargetResult } from '../../../services/automation/common/damageRollback.js';
import utils from '../../../services/ui/utils.js';
import './EyebiteEffectModal.css';

const EFFECT_OPTIONS = [
    { key: 'asleep', label: 'Asleep', condition: 'unconscious', description: 'The target has the Unconscious condition. It wakes up if it takes any damage or if another creature takes an action to shake it awake.' },
    { key: 'panicked', label: 'Panicked', condition: 'frightened', description: 'The target has the Frightened condition. On each of its turns, the Frightened target must take the Dash action and move away from you by the safest and shortest route available.' },
    { key: 'sickened', label: 'Sickened', condition: 'poisoned', description: 'The target has the Poisoned condition.' },
];

function EyebiteEffectModal({ combatSummary, attackerName, saveDc, campaignName, onClose, characters, featureName = 'Eyebite', rangeFeet = 60 }) {
    const [selectedEffect, setSelectedEffect] = useState(null);
    const [pendingPrompts, setPendingPrompts] = useState([]);
    const [popup, setPopup] = useState(null);

    useEffect(() => {
        return () => {
            setPendingPrompts([]);
        };
    }, []);

    const handleSelectEffect = useCallback((effect) => {
        setSelectedEffect(effect);
    }, []);

    const resolveSave = useCallback(async (targetName, effect, isNpc, saveBonus) => {
        storeSpellLastAttack(campaignName, {
            casterName: attackerName,
            spellName: featureName,
            saveType: 'WIS',
            saveDc,
            attackScope: 'single',
        });

        const effectLabel = effect.label;
        const conditionLabel = effect.condition.charAt(0).toUpperCase() + effect.condition.slice(1);

        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: attackerName,
            abilityName: featureName,
            description: `${attackerName} casts Eyebite (${effectLabel})! ${targetName} must make a WIS save (DC ${saveDc}) or gain the ${conditionLabel} condition.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[eyebiteEffectModal:log-error]", e); });

        if (isNpc) {
            const saveRoll = rollD20();
            const saveTotal = saveRoll + saveBonus;
            const success = saveTotal >= saveDc;

            sendSaveResult(campaignName, targetName, {
                promptId: utils.guid(),
                success,
                roll: saveRoll,
                total: saveTotal,
                saveBonus,
                rawRolls: [saveRoll, saveRoll],
            });

            if (!success) {
                const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
                const filtered = conditions.filter(c => String(c).toLowerCase() !== effect.condition);
                setRuntimeValue(targetName, 'activeConditions', [...filtered, effect.condition], campaignName);

                addExpiration({ attackerName, targetName, effects: [
                    { type: effect.condition, condition: effect.condition },
                ], campaignName });

                const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
                const effectKey = `eyebite_${effect.key}`;
                const newTargetEffects = [...targetEffects, {
                    target: targetName,
                    effect: effectKey,
                    source: attackerName,
                    condition: effect.condition,
                    duration: 'concentration',
                }];
                setRuntimeValue('campaign', 'targetEffects', newTargetEffects, campaignName);

                addTargetResult(campaignName, {
                    targetName,
                    saveResult: 'failure',
                    roll: saveRoll,
                    total: saveTotal,
                    conditions: [effect.condition],
                    appliedDamage: 0,
                });

                await addEntry(campaignName, {
                    type: 'save_result',
                    characterName: attackerName,
                    rollType: 'save-eyebite',
                    targetName,
                    saveDc,
                    saveType: 'WIS',
                    success: false,
                    description: `${targetName} failed WIS save against Eyebite (${effectLabel}).`,
                }).catch((e) => { console.error("[eyebiteEffectModal:log-error]", e); });

                await addEntry(campaignName, {
                    type: 'condition',
                    action: 'applied',
                    characterName: targetName,
                    condition: conditionLabel,
                    reason: 'Eyebite spell',
                    note: `${targetName} gains the ${conditionLabel} condition from Eyebite.`,
                    timestamp: Date.now(),
                }).catch((e) => { console.error("[eyebiteEffectModal:log-error]", e); });

                setPopup({
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: featureName,
                        description: `${targetName} failed on WIS save against ${featureName}. ${targetName} gains the ${conditionLabel} condition.`,
                    },
                });
            } else {
                addTargetResult(campaignName, {
                    targetName,
                    saveResult: 'success',
                    roll: saveRoll,
                    total: saveTotal,
                    conditions: [],
                    appliedDamage: 0,
                });

                await addEntry(campaignName, {
                    type: 'save_result',
                    characterName: attackerName,
                    rollType: 'save-eyebite',
                    targetName,
                    saveDc,
                    saveType: 'WIS',
                    success: true,
                    description: `${targetName} succeeded on WIS save against Eyebite (${effectLabel}).`,
                }).catch((e) => { console.error("[eyebiteEffectModal:log-error]", e); });

                setPopup({
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: featureName,
                        description: `${targetName} succeeded on WIS save against ${featureName}. Unaffected.`,
                    },
                });
            }
        } else {
            const promptId = utils.guid();
            sendSavePrompt(campaignName, {
                promptId,
                targetName,
                saveType: 'WIS',
                saveDc,
                sourceName: attackerName,
            });

            setPendingPrompts(prev => [...prev, { promptId, targetName, effect }]);

            await addEntry(campaignName, {
                type: 'save_result',
                characterName: attackerName,
                rollType: 'save-eyebite',
                targetName,
                saveDc,
                saveType: 'WIS',
                success: false,
                description: `${targetName} must make a WIS save (DC ${saveDc}) against Eyebite (${effectLabel})...`,
            }).catch((e) => { console.error("[eyebiteEffectModal:log-error]", e); });
        }
    }, [attackerName, campaignName, saveDc, featureName]);

    const handleTargetSelected = useCallback(async (targetName) => {
        const effect = selectedEffect;
        if (!effect) return;

        const targetCreature = combatSummary?.creatures?.find(c => c.name === targetName);
        const isNpc = !targetCreature || targetCreature.type === 'npc';

        const targetCharacter = characters?.find(c => utils.getName(c.name) === targetName);
        const targetStats = targetCharacter?.computedStats || targetCharacter || targetCreature;

        if (targetStats && playerIsImmuneToCondition({
            conditionKey: effect.condition,
            playerStats: targetStats,
            getRuntimeValue,
            campaignName,
        })) {
            storeSpellLastAttack(campaignName, {
                casterName: attackerName,
                spellName: featureName,
                saveType: 'WIS',
                saveDc,
                attackScope: 'single',
            });

            const conditionLabel = effect.condition.charAt(0).toUpperCase() + effect.condition.slice(1);

            await addEntry(campaignName, {
                type: 'ability_use',
                characterName: attackerName,
                abilityName: featureName,
                description: `${attackerName} casts Eyebite (${effect.label})! ${targetName} must make a WIS save (DC ${saveDc}) or gain the ${conditionLabel} condition.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[eyebiteEffectModal:log-error]", e); });

            await addEntry(campaignName, {
                type: 'save_result',
                characterName: attackerName,
                rollType: 'save-eyebite',
                targetName,
                saveDc,
                saveType: 'WIS',
                success: true,
                description: `${targetName} is immune to ${effect.condition} and automatically succeeds on the save against Eyebite (${effect.label}).`,
            }).catch((e) => { console.error("[eyebiteEffectModal:log-error]", e); });

            addTargetResult(campaignName, {
                targetName,
                saveResult: 'immune',
                roll: 0,
                total: 0,
                conditions: [],
                appliedDamage: 0,
            });

            setPopup({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `${targetName} is immune to ${effect.condition} and automatically succeeds on WIS save against ${featureName}. Unaffected.`,
                },
            });

            onClose();
            return;
        }

        const saveBonus = targetCreature?.saveBonuses?.wis ?? 0;
        await resolveSave(targetName, effect, isNpc, saveBonus);
    }, [selectedEffect, combatSummary, characters, attackerName, campaignName, saveDc, featureName, resolveSave, onClose]);

    const handleSkip = useCallback(() => {
        onClose();
    }, [onClose]);

    const handleSaveResult = useCallback(async (event) => {
        const detail = event.detail;
        if (!detail || !detail.promptId) return;

        const pendingIndex = pendingPrompts.findIndex(p => p.promptId === detail.promptId);
        if (pendingIndex === -1) return;

        const pendingTarget = pendingPrompts[pendingIndex];
        const targetName = pendingTarget.targetName;
        const effect = pendingTarget.effect;
        const success = detail.success;

        storeSpellLastAttack(campaignName, {
            casterName: attackerName,
            spellName: featureName,
            saveType: 'WIS',
            saveDc,
            attackScope: 'single',
        });

        const conditionLabel = effect.condition.charAt(0).toUpperCase() + effect.condition.slice(1);

        if (!success) {
            const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
            const filtered = conditions.filter(c => String(c).toLowerCase() !== effect.condition);
            setRuntimeValue(targetName, 'activeConditions', [...filtered, effect.condition], campaignName);

            addExpiration({ attackerName, targetName, effects: [
                { type: effect.condition, condition: effect.condition },
            ], campaignName });

            const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
            const effectKey = `eyebite_${effect.key}`;
            const newTargetEffects = [...targetEffects, {
                target: targetName,
                effect: effectKey,
                source: attackerName,
                condition: effect.condition,
                duration: 'concentration',
            }];
            setRuntimeValue('campaign', 'targetEffects', newTargetEffects, campaignName);

            addTargetResult(campaignName, {
                targetName,
                saveResult: 'failure',
                roll: detail.roll ?? 0,
                total: detail.total ?? 0,
                conditions: [effect.condition],
                appliedDamage: 0,
            });

            await addEntry(campaignName, {
                type: 'save_result',
                characterName: attackerName,
                rollType: 'save-eyebite',
                targetName,
                saveDc,
                saveType: 'WIS',
                success: false,
                description: `${targetName} failed WIS save against Eyebite (${effect.label}).`,
            }).catch((e) => { console.error("[eyebiteEffectModal:log-error]", e); });

            await addEntry(campaignName, {
                type: 'condition',
                action: 'applied',
                characterName: targetName,
                condition: conditionLabel,
                reason: 'Eyebite spell',
                note: `${targetName} gains the ${conditionLabel} condition from Eyebite.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[eyebiteEffectModal:log-error]", e); });

            setPopup({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `${targetName} failed on WIS save against ${featureName}. ${targetName} gains the ${conditionLabel} condition.`,
                },
            });
        } else {
            addTargetResult(campaignName, {
                targetName,
                saveResult: 'success',
                roll: detail.roll ?? 0,
                total: detail.total ?? 0,
                conditions: [],
                appliedDamage: 0,
            });

            await addEntry(campaignName, {
                type: 'save_result',
                characterName: attackerName,
                rollType: 'save-eyebite',
                targetName,
                saveDc,
                saveType: 'WIS',
                success: true,
                description: `${targetName} succeeded on WIS save against Eyebite (${effect.label}).`,
            }).catch((e) => { console.error("[eyebiteEffectModal:log-error]", e); });

            setPopup({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `${targetName} succeeded on WIS save against ${featureName}. Unaffected.`,
                },
            });
        }

        setPendingPrompts(prev => prev.filter(p => p.promptId !== detail.promptId));
    }, [pendingPrompts, attackerName, campaignName, saveDc, featureName]);

    useEffect(() => {
        if (pendingPrompts.length === 0) return;
        const handleSaveEvent = (event) => {
            handleSaveResult(event);
        };
        window.addEventListener('save-result', handleSaveEvent);
        return () => window.removeEventListener('save-result', handleSaveEvent);
    }, [pendingPrompts.length, handleSaveResult]);

    if (popup) {
        return (
            <div className="sp-overlay">
                <div className="sp-modal">
                    <div className="sp-header">
                        <i className="fa-solid fa-eye"></i> {featureName}
                    </div>
                    <div className="sp-body">
                        <p dangerouslySetInnerHTML={{ __html: popup.payload.description }} />
                    </div>
                    <div className="sp-actions">
                        <button className="sp-roll-btn" onClick={onClose} type="button">
                            <i className="fa-solid fa-check"></i> Done
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!selectedEffect) {
        return (
            <div className="sp-overlay">
                <div className="sp-modal">
                    <div className="sp-header">
                        <i className="fa-solid fa-eye"></i> {featureName}
                    </div>
                    <div className="sp-body">
                        <p>Choose an effect for the target:</p>
                        <div className="eyebite-effects-list">
                            {EFFECT_OPTIONS.map(effect => (
                                <button
                                    key={effect.key}
                                    className={`eyebite-effect-btn ${selectedEffect?.key === effect.key ? 'eyebite-effect-selected' : ''}`}
                                    onClick={() => handleSelectEffect(effect)}
                                    type="button"
                                >
                                    <strong>{effect.label}</strong>
                                    <span className="eyebite-effect-desc">
                                        {effect.description}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="sp-actions">
                        <button className="sp-dismiss-btn" onClick={onClose} type="button">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const effectLabel = selectedEffect.label;
    const targets = (combatSummary?.creatures || [])
        .filter(c => c.name !== attackerName)
        .map(c => ({ name: c.name, type: c.type }));

    const description = `Choose a creature within <strong>${rangeFeet} feet</strong>. It must make a WIS save (DC ${saveDc}) or be affected by Eyebite (${effectLabel}).`;

    return (
        <SecondaryTargetModal
            title={featureName}
            targets={targets}
            onTargetSelected={handleTargetSelected}
            onSkip={handleSkip}
            description={description}
            confirmLabel={`Cast ${featureName}`}
            confirmIcon="fa-solid fa-eye"
        />
    );
}

export default EyebiteEffectModal;
