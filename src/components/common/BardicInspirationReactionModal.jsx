import { useState, useCallback, useRef } from 'react';
import { rollExpression } from '../../services/dice/diceRoller.js';
import Subscriber from './Subscriber.jsx';
import { clearBardicInspiration } from '../../services/combat/auras/bardicInspirationState.js';
import { clearBardicInspirationPrompt } from '../../services/combat/prompts/bardicInspirationPromptUtils.js';
import './SavePromptModal.css';
import { useOverlayEntranceFocus } from '../../hooks/ui/useOverlayEntranceFocus.js';

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
        const prefix = `change-${campaignName}-`;
        if (!event.key.startsWith(prefix)) return;
        // Sole prompt shape: the `<name>-biPrompt` wildcard-key echo carrying the
        // raw prompt payload (bardicInspirationPromptUtils). A null payload (the
        // drain-to-evict DELETE echo) exits above — dismissal is the local Skip/
        // Resolve path; nothing re-enqueues an evicted prompt on a fresh connect.
        const match = event.key.slice(prefix.length).match(/^(.+)-biPrompt$/);
        if (!match) return;
        enqueuePrompt(match[1], event.data);
    }, [campaignName, enqueuePrompt]);

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
    // Entrance focus + stranded-close restore (backlog 2026-11-17 sp-overlay adoption).
    const overlayRef = useRef(null);
    useOverlayEntranceFocus(overlayRef, !!current);

    return (
        <>
            {typeof EventSource !== 'undefined' && (
                <Subscriber
                    campaignName={campaignName}
                    handleEvent={handleEvent}
                />
            )}
            {current && (
                <div className="sp-overlay" ref={overlayRef}>
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
