import { useState, useCallback, useRef } from 'react';
import { rollExpression } from '../../services/dice/diceRoller.js';
import Subscriber from './Subscriber.jsx';
import { clearBardicInspiration } from '../../services/combat/auras/bardicInspirationState.js';
import { clearBardicInspirationPrompt } from '../../services/combat/prompts/bardicInspirationPromptUtils.js';
import './SavePromptModal.css';

function BardicInspirationReactionModal({ campaignName }) {
    const [prompts, setPrompts] = useState([]);
    const current = prompts.length > 0 ? prompts[0] : null;
    // eslint-disable-next-line server-first/no-local-game-state
    const activePromptIdRef = useRef(null);
    const promptsRef = useRef([]);
    const processedPromptIdsRef = useRef(new Set());

    const advance = useCallback(() => {
        setPrompts(prev => {
            const next = prev.slice(1);
            activePromptIdRef.current = null;
            promptsRef.current = next;
            processedPromptIdsRef.current.clear();
            return next;
        });
    }, []);

    const enqueuePrompt = useCallback((targetName, promptData) => {
        const promptId = promptData?.promptId;
        if (!promptId) return;
        if (processedPromptIdsRef.current.has(promptId)) return;
        if (activePromptIdRef.current !== null) return;
        if (promptsRef.current.some(p => p.promptId === promptId)) return;
        processedPromptIdsRef.current.add(promptId);
        activePromptIdRef.current = promptId;
        setPrompts(prev => {
            const next = [...prev, { targetName, ...promptData }];
            promptsRef.current = next;
            return next;
        });
    }, []);

    const handleEvent = useCallback((event) => {
        if (!event.key || event.data == null) return;
        const charMatch = event.key.match(/^change-([^]+)-(.+)$/);
        if (charMatch && typeof event.data === 'object' && event.data.biPrompt?.promptId) {
            enqueuePrompt(charMatch[2], event.data.biPrompt);
            return;
        }
        const prefix = `change-${campaignName}-`;
        if (!event.key.startsWith(prefix)) return;
        const match = event.key.slice(prefix.length).match(/^(.+)-biPrompt$/);
        if (!match) return;
        enqueuePrompt(match[1], event.data);
    }, [campaignName, enqueuePrompt]);

    const handleClearedEvent = useCallback((event) => {
        if (!event.key || event.data == null) return;
        const prefix = `change-${campaignName}-`;
        if (!event.key.startsWith(prefix)) return;
        const keySuffix = event.key.slice(prefix.length);
        const match = keySuffix.match(/^(.+)-biPromptCleared$/);
        if (!match) return;
        if (!event.data?.promptId) return;
        setPrompts(prev => {
            const next = prev.filter(p => p.promptId !== event.data.promptId);
            promptsRef.current = next;
            return next;
        });
    }, [campaignName]);

    const handleDismiss = useCallback(() => {
        if (current) {
            clearBardicInspirationPrompt(campaignName, current.mode === 'offense' ? current.attackerName : current.targetName);
            advance();
        }
    }, [campaignName, current, advance]);

    const handleUseReaction = useCallback(async () => {
        if (!current) return;
        const promptId = current.promptId;
        const dieRoll = rollExpression(`1d${current.dieSize}`);
        const biRoll = dieRoll?.total || 0;

        if (current.mode === 'defense') {
            clearBardicInspirationPrompt(campaignName, current.targetName);
            clearBardicInspiration(current.targetName, campaignName);
        } else {
            clearBardicInspirationPrompt(campaignName, current.attackerName);
            clearBardicInspiration(current.attackerName, campaignName);
        }

        window.dispatchEvent(new CustomEvent(`bardic-inspiration-${current.mode}-result`, {
            detail: { promptId, used: true, biRoll },
        }));

        advance();
    }, [campaignName, current, advance]);

    const handleSkip = useCallback(() => {
        if (!current) return;
        const promptId = current.promptId;
        window.dispatchEvent(new CustomEvent(`bardic-inspiration-${current.mode}-result`, {
            detail: { promptId, used: false },
        }));
        clearBardicInspirationPrompt(campaignName, current.mode === 'offense' ? current.attackerName : current.targetName);
        advance();
    }, [campaignName, current, advance]);

    return (
        <>
            {typeof EventSource !== 'undefined' && (
                <Subscriber
                    campaignName={campaignName}
                    handleEvent={(event) => {
                        handleEvent(event);
                        handleClearedEvent(event);
                    }}
                />
            )}
            {current && (
                <div className="sp-overlay" onClick={(e) => {
                    if (e.target.closest('.sp-modal')) return;
                    handleDismiss?.();
                }}>
                    <div className="sp-modal">
                        <div className="sp-header">
                            <i className="fa-solid fa-bard"></i> {current.mode === 'defense' ? 'Combat Inspiration - Defense' : 'Combat Inspiration - Offense'}
                        </div>
                        <div className="sp-body">
                            {current.mode === 'defense' ? (
                                <>
                                    <p><strong>{current.targetName}</strong> is hit by <strong>{current.attackerName}</strong>'s attack!</p>
                                    <p className="sp-dc">Attack: d20({current.attackRoll}) + {current.bonus} = {current.attackRoll + current.bonus} vs AC {current.effectiveAc}</p>
                                    <p className="sp-note">Use your Reaction to roll your Bardic Inspiration die (d{current.dieSize}) and add to your AC?</p>
                                </>
                            ) : (
                                <>
                                    <p><strong>{current.attackerName}</strong> hit <strong>{current.targetName}</strong>!</p>
                                    <p className="sp-note">Use your Reaction to roll your Bardic Inspiration die (d{current.dieSize}) and add to the damage?</p>
                                </>
                            )}
                        </div>
                        <div className="sp-actions">
                            <button className="sp-roll-btn" onClick={handleUseReaction} type="button">
                                <i className="fa-solid fa-dice-d20"></i> Use Reaction & Roll
                            </button>
                            <button className="sp-dismiss-btn" onClick={handleSkip} type="button">
                                Skip
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default BardicInspirationReactionModal;
