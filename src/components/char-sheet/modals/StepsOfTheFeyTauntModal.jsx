import { useState } from 'react';
import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';
import { createSaveListener } from '../../../services/automation/common/savePrompt.js';
import { addEntry } from '../../../services/ui/logService.js';
import { addExpiration } from '../../../services/rules/effects/expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { getCombatContext } from '../../../services/rules/combat/damageUtils.js';
import '../CharSheet.css';

function StepsOfTheFeyTauntModal({ mode, title, targets, action, playerStats, campaignName, saveDc, featureName, newCount, onClose }) {
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);
    const [choice, setChoice] = useState(null);

    const playerName = playerStats.name;

    const options = [
        {
            key: 'refreshing',
            label: 'Refreshing Step',
            icon: 'fa-heart-pulse',
            description: 'Gain 1d10 Temporary Hit Points.',
        },
        {
            key: 'taunting',
            label: 'Taunting Step',
            icon: 'fa-wand-sparkles',
            description: 'Creatures within 5 ft must make a WIS save or have Disadvantage on attack rolls against creatures other than you.',
        },
        {
            key: 'disappearing',
            label: 'Disappearing Step',
            icon: 'fa-eye-slash',
            description: 'You have the Invisible condition until the start of your next turn.',
        },
        {
            key: 'dreadful',
            label: 'Dreadful Step',
            icon: 'fa-brain',
            description: 'Creatures within 5 ft must make a WIS save (DC ' + saveDc + ') or take 2d10 Psychic damage.',
        },
    ];

    const handleChoice = (selectedKey) => {
        setChoice(selectedKey);
    };

    const handleSkipChoice = () => {
        handleSkip();
    };

    const applyRefreshingStep = async () => {
        const tempHpRoll = Math.floor(Math.random() * 10) + 1;
        const existingTempHp = Number(getRuntimeValue(playerName, 'tempHp', campaignName) ?? 0);
        const newTempHp = Math.max(existingTempHp, tempHpRoll);
        await setRuntimeValue(playerName, 'tempHp', newTempHp, campaignName);

        const description = `${featureName}: Cast Misty Step without expending a spell slot (${newCount} remaining).<br/><br/><b>Refreshing Step:</b> Gained ${tempHpRoll} Temporary Hit Points.`;
        setResult({ description });
        setApplied(true);
    };

    const applyDisappearingStep = async () => {
        const storedConditions = getRuntimeValue(playerName, 'activeConditions', campaignName) || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        if (!conditions.some(c => String(c).toLowerCase() === 'invisible')) {
            await setRuntimeValue(playerName, 'activeConditions', [...conditions, 'invisible'], campaignName);
        }

        addExpiration(playerName, playerName, [
            { type: 'condition', condition: 'invisible' }
        ], campaignName, undefined, playerName);

        const description = `${featureName}: Cast Misty Step without expending a spell slot (${newCount} remaining).<br/><br/><b>Disappearing Step:</b> You have the Invisible condition until the start of your next turn.`;
        setResult({ description });
        setApplied(true);
    };

    const handleSkip = () => {
        const modeLabel = mode === 'mistyEscape' ? 'Dreadful Step' : 'Taunting Step';
        const description = `${featureName}: Cast Misty Step without expending a spell slot (${newCount} remaining).<br/><br/><b>${modeLabel}:</b> No targets selected.`;
        setResult({ description });
        setApplied(true);
    };

    const handleTauntConfirm = async (selectedTargets) => {
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

        const description = `${featureName}: Cast Misty Step without expending a spell slot (${newCount} remaining).<br/><br/><b>Taunting Step:</b> ${selectedTargets.length} creature(s) targeted. ${failedCount} failed save — Disadvantage on attack rolls vs others. ${savedCount} saved.`;
        setResult({ description });
        setApplied(true);
    };

    const handleDreadfulConfirm = async (selectedTargets) => {
        const promptIds = [];
        const combatContext = await getCombatContext(campaignName);
        const characters = combatContext?.creatures || [];

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
                description: `${featureName} triggered — ${targetName} must make WIS save (DC ${saveDc}) or take 2d10 Psychic damage.`,
                promptId,
            }).catch((e) => { console.error("[dreadfulStep] Error:", e); });
        }

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

        let failedCount = 0;
        let savedCount = 0;
        let totalDamage = 0;
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
                }).catch((e) => { console.error("[dreadfulStep] Error:", e); });
                resultsDetail.push(`${targetName} saved.`);
            } else {
                failedCount++;
                const damageRoll = Math.floor(Math.random() * 10) + 1 + Math.floor(Math.random() * 10) + 1;
                totalDamage += damageRoll;

                if (combatContext?.creatures) {
                    applyDamageToTarget(
                        combatContext,
                        targetName,
                        damageRoll,
                        ['Psychic'],
                        campaignName,
                        characters,
                        false,
                        playerName
                    );
                }

                addEntry(campaignName, {
                    type: 'save_result',
                    characterName: playerName,
                    rollType: `save-${action.automation.type}`,
                    targetName,
                    saveDc,
                    saveType: 'WIS',
                    success: false,
                    description: `${targetName} failed WIS save. ${targetName} takes ${damageRoll} Psychic damage.`,
                }).catch((e) => { console.error("[dreadfulStep] Error:", e); });

                resultsDetail.push(`${targetName} failed — ${damageRoll} Psychic damage.`);
            }
        }

        const description = `${featureName}: Cast Misty Step without expending a spell slot (${newCount} remaining).<br/><br/><b>Dreadful Step:</b> ${selectedTargets.length} creature(s) targeted. ${failedCount} failed save — ${totalDamage} Psychic damage. ${savedCount} saved.`;
        setResult({ description });
        setApplied(true);
    };

    const renderChoiceStep = () => (
        <div className="sp-overlay" onClick={handleSkipChoice}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className={`fa-solid fa-wand-sparkles`}></i> {title || featureName}
                </div>
                <div className="sp-body">
                    <p>Choose how you use <b>{title || featureName}</b>:</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                        {options.map(option => (
                            <div
                                key={option.key}
                                className="clickable"
                                onClick={() => handleChoice(option.key)}
                                style={{
                                    padding: '12px',
                                    border: '1px solid #555',
                                    borderRadius: '6px',
                                    backgroundColor: '#1a1a2e',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                    <i className={`fa-solid ${option.icon}`} style={{ fontSize: '1.2em', color: '#4fc3f7' }}></i>
                                    <strong>{option.label}</strong>
                                </div>
                                <div style={{ fontSize: '0.9em', color: '#ccc' }}>{option.description}</div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-dismiss-btn" onClick={handleSkipChoice} type="button">Skip</button>
                </div>
            </div>
        </div>
    );

    const renderDisappearingConfirm = () => (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-eye-slash"></i> {title || featureName}
                </div>
                <div className="sp-body">
                    <p>Use <b>Disappearing Step</b>?</p>
                    <p style={{ color: '#ccc' }}>You gain the Invisible condition until the start of your next turn.</p>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={applyDisappearingStep}>
                        <i className="fa-solid fa-eye-slash"></i> Disappear
                    </button>
                    <button className="sp-dismiss-btn" onClick={handleSkipChoice} type="button">Cancel</button>
                </div>
            </div>
        </div>
    );

    const renderRefreshingConfirm = () => (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-heart-pulse"></i> {title || featureName}
                </div>
                <div className="sp-body">
                    <p>Use <b>Refreshing Step</b>?</p>
                    <p style={{ color: '#ccc' }}>You gain 1d10 Temporary Hit Points.</p>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={applyRefreshingStep}>
                        <i className="fa-solid fa-heart-pulse"></i> Refresh
                    </button>
                    <button className="sp-dismiss-btn" onClick={handleSkipChoice} type="button">Cancel</button>
                </div>
            </div>
        </div>
    );

    const renderDreadfulConfirm = () => (
        <CreatureSelectionModal
            title={title || featureName}
            icon="fa-brain"
            targets={targets}
            description={`Creatures within 5 feet of the space you left or appear in must make a WIS save (DC ${saveDc}) or take 2d10 Psychic damage.`}
            note="Dreadful Step: Select creatures to target."
            confirmLabel="Dreadful"
            confirmIcon="fa-brain"
            onConfirm={handleDreadfulConfirm}
            onSkip={handleSkip}
        />
    );

    const renderTauntConfirm = () => (
        <CreatureSelectionModal
            title={title || featureName}
            icon="fa-wand-sparkles"
            targets={targets}
            description="Creatures within 5 feet of the space you left must make a WIS save or have Disadvantage on attack rolls against creatures other than you."
            note="Taunting Step: Select creatures to taunt."
            confirmLabel="Taunt"
            confirmIcon="fa-wand-sparkles"
            onConfirm={handleTauntConfirm}
            onSkip={handleSkip}
        />
    );

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-wand-sparkles"></i> {title || featureName}
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

    if (choice === 'refreshing') {
        return renderRefreshingConfirm();
    }

    if (choice === 'taunting') {
        return renderTauntConfirm();
    }

    if (choice === 'disappearing') {
        return renderDisappearingConfirm();
    }

    if (choice === 'dreadful') {
        return renderDreadfulConfirm();
    }

    return renderChoiceStep();
}

export default StepsOfTheFeyTauntModal;
