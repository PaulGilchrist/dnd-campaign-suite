import { useState } from 'react';
import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';
import { createSaveListener } from '../../../services/automation/common/savePrompt.js';
import { addEntry } from '../../../services/ui/logService.js';
import { addExpiration } from '../../../services/rules/effects/expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import '../CharSheet.css';

function StepsOfTheFeyTauntModal({ targets, action, playerStats, campaignName, saveDc, featureName, tempHpRoll, newCount, onClose }) {
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const handleSkip = () => {
        const description = `${featureName}: Cast Misty Step without expending a spell slot (${newCount} remaining).<br/><br/><b>Refreshing Step:</b> Gained ${tempHpRoll} Temporary Hit Points.<br/><br/><b>Taunting Step:</b> No targets selected.`;
        setResult({ description });
        setApplied(true);
    };

    const handleConfirm = async (selectedTargets) => {
        const playerName = playerStats.name;
        const promptIds = [];

        for (const target of selectedTargets) {
            const targetName = target.name || target;
            const { promptId } = createSaveListener(campaignName, {
                targetName,
                saveType: 'WIS',
                saveDc,
            });
            promptIds.push({ targetName, promptId });

            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: featureName,
                description: `${featureName} triggered — ${targetName} must make WIS save (DC ${saveDc}) or have Disadvantage on attack rolls against creatures other than ${playerName}.`,
                promptId,
            }).catch((e) => { console.error("[stepsOfTheFey] Error:", e); });
        }

        // Wait for all save results
        const saveResults = await Promise.all(
            promptIds.map(({ targetName, promptId }) =>
                new Promise((resolve) => {
                    const handler = (event) => {
                        if (event.detail.promptId !== promptId) return;
                        window.removeEventListener('save-result', handler);
                        resolve({ targetName, success: event.detail.success });
                    };
                    window.addEventListener('save-result', handler);
                })
            )
        );

        // Process results and apply effects
        let failedCount = 0;
        let savedCount = 0;
        const resultsDetail = [];

        for (const { targetName, success } of saveResults) {
            if (success) {
                savedCount++;
                addEntry(campaignName, {
                    type: 'save_result',
                    characterName: playerName,
                    rollType: `save-${action.automation.type}`,
                    targetName,
                    saveDc,
                    saveType: 'WIS',
                    success: true,
                    description: `${targetName} succeeded on WIS save from ${featureName}. No effect.`,
                }).catch((e) => { console.error("[stepsOfTheFey] Error:", e); });
                resultsDetail.push(`${targetName} saved.`);
            } else {
                failedCount++;

                const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                const tauntingEffect = {
                    effect: 'taunting_step',
                    target: targetName,
                    source: playerName,
                    duration: 'until_start_of_next_turn',
                    timestamp: Date.now(),
                };
                const existingIndex = storedEffects.findIndex(
                    te => te.effect === 'taunting_step' && te.target === targetName
                );
                if (existingIndex >= 0) {
                    storedEffects[existingIndex] = tauntingEffect;
                } else {
                    storedEffects.push(tauntingEffect);
                }
                await setRuntimeValue(campaignName, 'targetEffects', storedEffects, campaignName);

                addExpiration(playerName, targetName, [
                    { type: 'targetEffect', effect: 'taunting_step', target: targetName }
                ], campaignName, undefined, playerName);

                addEntry(campaignName, {
                    type: 'save_result',
                    characterName: playerName,
                    rollType: `save-${action.automation.type}`,
                    targetName,
                    saveDc,
                    saveType: 'WIS',
                    success: false,
                    description: `${targetName} failed WIS save. ${targetName} has Disadvantage on attack rolls against creatures other than ${playerName} until start of ${playerName}'s next turn.`,
                }).catch((e) => { console.error("[stepsOfTheFey] Error:", e); });

                resultsDetail.push(`${targetName} failed — Disadvantage on attacks vs others.`);
            }
        }

        const description = `${featureName}: Cast Misty Step without expending a spell slot (${newCount} remaining).<br/><br/><b>Refreshing Step:</b> Gained ${tempHpRoll} Temporary Hit Points.<br/><br/><b>Taunting Step:</b> ${selectedTargets.length} creature(s) targeted. ${failedCount} failed save — Disadvantage on attack rolls vs others. ${savedCount} saved.`;
        setResult({ description });
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-wand-sparkles"></i> {featureName}
                    </div>
                    <div className="sp-body" dangerouslySetInnerHTML={{ __html: result.description }}>
                    </div>
                    <div className="sp-actions">
                        <button className="sp-roll-btn" onClick={onClose}>Done</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <CreatureSelectionModal
            title={featureName}
            icon="fa-wand-sparkles"
            targets={targets}
            description="Creatures within 5 feet of the space you left must make a WIS save or have Disadvantage on attack rolls against creatures other than you."
            note="Refreshing Step: You gain 1d10 Temporary Hit Points. Taunting Step: Select creatures to taunt."
            confirmLabel="Taunt"
            confirmIcon="fa-wand-sparkles"
            onConfirm={handleConfirm}
            onSkip={handleSkip}
        />
    );
}

export default StepsOfTheFeyTauntModal;
