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

    const enqueuePrompt = useCallback((keySuffix, promptData) => {
        const promptId = promptData?.promptId;
        if (!promptId) return;
        // Single-shape law (bug-bi-defense-prompt-producer-orphaned, owner
        // decision 2026-11-17): the ONLY payload this lane mounts is an OFFENSE
        // prompt keyed on the attacking creature. A `mode: 'defense'` payload is
        // a dead shape — defense adjudication lives exclusively on the popup-
        // inline `Bardic Inspiration - Defense (dN)` button (hitResolution.js
        // applyBardicInspirationDefense) — so it never mounts here.
        if (promptData.mode !== 'offense') return;
        if (processedPromptIdsRef.current.has(promptId)) return;
        if (activePromptIdRef.current !== null) return;
        if (promptsRef.current.some(p => p.promptId === promptId)) return;
        processedPromptIdsRef.current.add(promptId);
        activePromptIdRef.current = promptId;
        setPrompts(prev => {
            // The arrival key identifies the exact server key this prompt lives
            // on ('<attackerName>-biPrompt'), so a cleared echo can dequeue
            // precisely it (SavePromptModal's promptKeySuffix doctrine).
            const next = [...prev, { promptKeySuffix: keySuffix, ...promptData }];
            promptsRef.current = next;
            return next;
        });
    }, []);

    // Cleared-key echo (the drain-to-evict DELETE broadcast): the prompt was
    // resolved or skipped on another tab — dequeue the un-adjudicated prompt
    // sitting on that exact server key so a twin tab's mounted modal self-evicts
    // instead of staying actionable on a resolved adjudication. Drops the
    // promptId dedupe entry (a fresh value echo on the key legitimately revives
    // the prompt — clearPromptKeys/revive doctrine, SavePromptModal).
    const dequeuePrompt = useCallback((keySuffix) => {
        setPrompts(prev => {
            const next = prev.filter(p => p.promptKeySuffix !== keySuffix);
            if (next.length === prev.length) return prev;
            const removed = prev.find(p => p.promptKeySuffix === keySuffix);
            if (removed.promptId === activePromptIdRef.current) activePromptIdRef.current = null;
            processedPromptIdsRef.current.delete(removed.promptId);
            promptsRef.current = next;
            return next;
        });
    }, []);

    const handleEvent = useCallback((event) => {
        if (!event.key) return;
        const prefix = `change-${campaignName}-`;
        if (!event.key.startsWith(prefix)) return;
        // Sole prompt shape: the `<name>-biPrompt` wildcard-key echo carrying the
        // raw OFFENSE prompt payload (`name` = the attacking creature;
        // bardicInspirationPromptUtils). A null payload is the drain-to-evict
        // DELETE echo: it DE-queues (handleEvent's cleared branch) but never
        // mounts — the no-re-enqueue law that keeps an evicted prompt from
        // resurrecting on a fresh connect.
        const match = event.key.slice(prefix.length).match(/^(.+)-biPrompt$/);
        if (!match) return;
        const keySuffix = `${match[1]}-biPrompt`;
        if (event.data == null) {
            dequeuePrompt(keySuffix);
            return;
        }
        enqueuePrompt(keySuffix, event.data);
    }, [campaignName, enqueuePrompt, dequeuePrompt]);

    const handleUseReaction = useCallback(async () => {
        if (!current) return;
        const promptId = current.promptId;
        const dieRoll = rollExpression(`1d${current.dieSize}`);
        const biRoll = dieRoll?.total || 0;

        // The attacker spends their own inspiration and answers on their own key.
        clearBardicInspirationPrompt(campaignName, current.attackerName);
        clearBardicInspiration(current.attackerName, campaignName);

        window.dispatchEvent(new CustomEvent('bardic-inspiration-offense-result', {
            detail: { promptId, used: true, biRoll },
        }));

        advance();
    }, [campaignName, current, advance]);

    const handleSkip = useCallback(() => {
        if (!current) return;
        const promptId = current.promptId;
        window.dispatchEvent(new CustomEvent('bardic-inspiration-offense-result', {
            detail: { promptId, used: false },
        }));
        clearBardicInspirationPrompt(campaignName, current.attackerName);
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
                            <i className="fa-solid fa-bard"></i> Combat Inspiration - Offense
                        </div>
                        <div className="sp-body">
                            <p><strong>{current.attackerName}</strong> hit <strong>{current.targetName}</strong>!</p>
                            <p className="sp-note">Use your Reaction to roll your Bardic Inspiration die (d{current.dieSize}) and add to the damage?</p>
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
