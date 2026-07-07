import { useState, useCallback, useRef } from 'react';
import { rollExpression } from '../../services/dice/diceRoller.js';
import Subscriber from './Subscriber.jsx';
import { clearBardicInspiration } from '../../services/combat/auras/bardicInspirationState.js';
import { clearBardicInspirationPrompt } from '../../services/combat/prompts/bardicInspirationPromptUtils.js';
import { addEntry } from '../../services/ui/logService.js';
import './savePromptModal.css';

function BardicInspirationReactionModal({ campaignName }) {
    const [prompts, setPrompts] = useState([]);
    const current = prompts.length > 0 ? prompts[0] : null;
    const activePromptIdRef = useRef(null);

    const advance = useCallback(() => {
        setPrompts(prev => {
            const next = prev.slice(1);
            const dismissed = prev[0];
            if (dismissed) seenPromptIds.current.delete(dismissed.promptId);
            return next;
        });
    }, []);

    const handleEvent = useCallback((event) => {
        if (!event.key || event.data == null) return;
        // The biPrompt is stored as a property within the character store.
        // SSE broadcasts the full character object under `change-{campaign}-{characterName}`.
        const charMatch = event.key.match(/^change-([^]+)-(.+)$/);
        if (charMatch) {
            const characterName = charMatch[2];
            if (event.data && typeof event.data === 'object' && event.data.biPrompt) {
                const promptData = event.data.biPrompt;
                if (promptData && promptData.promptId && !seenPromptIds.current.has(promptData.promptId)) {
                    seenPromptIds.current.add(promptData.promptId);
                    setPrompts(prev => [...prev, { targetName: characterName, ...promptData }]);
                    return;
                }
            }
        }
        // Also handle the old direct biPrompt key format for backward compatibility
        const prefix = `change-${campaignName}-biPrompt-`;
        if (event.key.startsWith(prefix)) {
            const targetName = event.key.slice(prefix.length);
            if (!targetName || !event.data?.promptId || seenPromptIds.current.has(event.data.promptId)) return;
            seenPromptIds.current.add(event.data.promptId);
            setPrompts(prev => [...prev, { targetName, ...event.data }]);
        }
    }, [campaignName]);

    const handleClearedEvent = useCallback((event) => {
        if (!event.key || event.data == null) return;
        const prefix = `change-${campaignName}-biPromptCleared-`;
        if (!event.key.startsWith(prefix)) return;
        if (!event.data?.promptId) return;
        setPrompts(prev => prev.filter(p => p.promptId !== event.data.promptId));
    }, [campaignName]);

    const handleDismiss = useCallback(() => {
        if (current) {
            clearBardicInspirationPrompt(campaignName, current.targetName);
            advance();
        }
    }, [campaignName, current, advance]);

    const handleUseReaction = useCallback(async () => {
        if (!current) return;
        const promptId = current.promptId;
        const dieRoll = rollExpression(`1d${current.dieSize}`);
        const biRoll = dieRoll?.total || 0;

        if (current.mode === 'defense') {
            clearBardicInspiration(current.targetName, campaignName);
        } else {
            clearBardicInspiration(current.attackerName, campaignName);
        }

        if (current.mode === 'defense') {
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: current.targetName,
                abilityName: 'Combat Inspiration - Defense',
                description: `${current.targetName} used Combat Inspiration - Defense, rolling ${biRoll} (d${current.dieSize}) to boost AC.`,
                biDieRoll: biRoll,
                timestamp: Date.now(),
            }).catch(() => {});
        } else {
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: current.attackerName,
                abilityName: 'Combat Inspiration - Offense',
                description: `${current.attackerName} used Combat Inspiration - Offense, rolling ${biRoll} (d${current.dieSize}) bonus damage.`,
                biDieRoll: biRoll,
                timestamp: Date.now(),
            }).catch(() => {});
        }

        window.dispatchEvent(new CustomEvent(`bardic-inspiration-${current.mode}-result`, {
            detail: { promptId, used: true, biRoll },
        }));

        clearBardicInspirationPrompt(campaignName, current.targetName);
        advance();
    }, [campaignName, current, advance]);

    const handleSkip = useCallback(() => {
        if (!current) return;
        const promptId = current.promptId;
        window.dispatchEvent(new CustomEvent(`bardic-inspiration-${current.mode}-result`, {
            detail: { promptId, used: false },
        }));
        clearBardicInspirationPrompt(campaignName, current.targetName);
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
                <div className="sp-overlay" onClick={handleDismiss}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
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
