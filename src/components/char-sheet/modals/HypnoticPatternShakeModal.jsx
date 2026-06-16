import { useState, useCallback } from 'react';
import { executeHandler } from '../../../services/automation/index.js';
import { addEntry } from '../../../services/ui/logService.js';

function HypnoticPatternShakeModal({ attackerName, campaignName, targets, rangeFeet, featureName, onClose }) {
    const [selected, setSelected] = useState(null);
    const [processing, setProcessing] = useState(false);

    const handleShake = useCallback(async () => {
        if (!selected) return;
        setProcessing(true);

        const action = {
            automation: {
                type: 'hypnotic_pattern_shake',
                range: `${rangeFeet} ft`,
            },
            name: featureName || 'Shake Out Stupor',
        };

        try {
            const result = await executeHandler(action, { name: attackerName }, campaignName, null);
            if (result) {
                await addEntry(campaignName, {
                    type: 'ability_use',
                    characterName: attackerName,
                    abilityName: 'Shake Out Stupor',
                    description: `${attackerName} used an action to shake ${selected} out of its hypnotic stupor.`,
                    targetName: selected,
                    timestamp: Date.now(),
                }).catch(() => {});
            }
        } catch (e) {
            console.error('[HypnoticPatternShake] Failed:', e);
        }

        setProcessing(false);
        onClose();
    }, [selected, attackerName, campaignName, rangeFeet, featureName, onClose]);

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-brain"></i> {featureName || 'Shake Out Stupor'}
                </div>
                <div className="sp-body">
                    {!processing ? (
                        <>
                            <p>Select a creature to shake out of its hypnotic stupor. The target must be within {rangeFeet} feet and affected by Hypnotic Pattern.</p>
                            <div className="abjure-targets-list">
                                {targets.map(t => (
                                    <label key={t} className={`abjure-target-row ${selected === t ? 'abjure-target-selected' : ''}`}>
                                        <input
                                            type="radio"
                                            name="hypnoticShakeTarget"
                                            checked={selected === t}
                                            onChange={() => setSelected(t)}
                                        />
                                        <span className="abjure-target-name">{t}</span>
                                    </label>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p>Shaking target free...</p>
                    )}
                </div>
                <div className="sp-actions">
                    {!processing ? (
                        <>
                            <button className="sp-roll-btn" onClick={handleShake} disabled={!selected} type="button">
                                <i className="fa-solid fa-hand"></i> Shake Free ({selected ? selected : 'none'})
                            </button>
                            <button className="sp-dismiss-btn" onClick={onClose} type="button">
                                Cancel
                            </button>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export default HypnoticPatternShakeModal;
