import { useState, useEffect, useCallback } from 'react';
import './conditionChoiceModal.css';

function ConditionChoiceModal() {
    const [current, setCurrent] = useState(null);

    useEffect(() => {
        const handler = (event) => {
            setCurrent(event.detail);
        };
        window.addEventListener('condition-choice-show', handler);
        return () => window.removeEventListener('condition-choice-show', handler);
    }, []);

    const handleChoice = useCallback((condition) => {
        if (!current) return;
        window.dispatchEvent(new CustomEvent('condition-choice-selected', {
            detail: { promptId: current.promptId, condition },
        }));
        setCurrent(null);
    }, [current]);

    const handleSkip = useCallback(() => {
        if (!current) return;
        window.dispatchEvent(new CustomEvent('condition-choice-skipped', {
            detail: { promptId: current.promptId },
        }));
        setCurrent(null);
    }, [current]);

    if (!current) return null;

    return (
        <div className="cc-overlay">
            <div className="cc-modal">
                <div className="cc-header">
                    <i className="fa-solid fa-magic"></i> Choose Condition
                </div>
                <div className="cc-body">
                    <p>
                        <strong>{current.targetName}</strong> failed the saving throw.
                        Choose which condition to apply for 1 minute:
                    </p>
                </div>
                <div className="cc-actions">
                    {current.conditions.map((condition) => (
                        <button
                            key={condition}
                            className="cc-choice-btn"
                            onClick={() => handleChoice(condition)}
                            type="button"
                        >
                            {condition.charAt(0).toUpperCase() + condition.slice(1)}
                        </button>
                    ))}
                    <button
                        className="cc-skip-btn"
                        onClick={handleSkip}
                        type="button"
                    >
                        <i className="fa-solid fa-ban"></i> Skip (No Effect)
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConditionChoiceModal;
