import { useState, useEffect } from 'react';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import './BastionOfLawModal.css';

function BastionOfLawModal({ featureName, creatureTargets, playerName, campaignName, auto, onClose, onConfirm }) {
    const [selectedTarget, setSelectedTarget] = useState(null);
    const [spAmount, setSpAmount] = useState(1);

    const maxSP = auto?.maxSP || 5;
    const minSP = auto?.minSP || 1;

    useEffect(() => {
        const spPool = getRuntimeValue(playerName, 'sorceryPoints', campaignName);
        const spMax = 10;
        const spCurrent = Number(spPool) || spMax;
        const maxSpendable = Math.min(maxSP, spCurrent);
        setSpAmount(prev => Math.max(minSP, Math.min(maxSpendable, prev)));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const canCreateWard = selectedTarget != null && spAmount >= minSP;

    const handleCreateWard = async () => {
        console.error('[bastionOfLaw] handleCreateWard', { canCreateWard, spAmount, selectedTarget });
        if (!canCreateWard) return;
        if (onConfirm) {
            const result = await onConfirm(spAmount, selectedTarget);
            console.error('[bastionOfLaw] onConfirm result', result);
        }
        onClose();
    };

    const rangeDisplay = auto?.range ? auto.range.replace(/_/g, ' ') : '30 ft';

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-shield-halved"></i> {featureName}
                </div>
                <div className="sp-body">
                    <p>Choose a creature to create a magical ward on. Each sorcery point spent creates one d8 in the ward dice pool.</p>

                    <div className="bastion-target-list">
                        {creatureTargets.map((target, i) => (
                            <label
                                key={i}
                                className={`bastion-target-option ${selectedTarget === target.name ? 'selected' : ''}`}
                                onClick={() => setSelectedTarget(target.name)}
                            >
                                <input
                                    type="radio"
                                    name="bastionTarget"
                                    checked={selectedTarget === target.name}
                                    onChange={() => {}}
                                />
                                <span className="target-name">{target.name}</span>
                                <span className="target-type">{target.type}</span>
                                {target.currentHp != null && (
                                    <span className="target-hp">{target.currentHp}/{target.maxHp} HP</span>
                                )}
                            </label>
                        ))}
                    </div>

                    <div className="bastion-sp-section">
                        <label>
                            Sorcery Points to spend:
                            <input
                                type="number"
                                min={minSP}
                                max={maxSP}
                                value={spAmount}
                                onChange={(e) => setSpAmount(Math.max(minSP, Math.min(maxSP, Number(e.target.value) || minSP)))}
                            />
                        </label>
                        <span className="bastion-sp-preview">Creates {spAmount}d8 ward</span>
                    </div>

                    <div className="bastion-details">
                        <ul>
                            <li>Ward dice: {spAmount}d8</li>
                            <li>Range: {rangeDisplay}</li>
                            <li>Duration: Long Rest or until target uses it</li>
                            <li>Target uses Reaction when taking damage to spend dice</li>
                        </ul>
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleCreateWard} disabled={!canCreateWard}>
                        <i className="fa-solid fa-shield-halved"></i> Create Ward ({spAmount}d8)
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default BastionOfLawModal;
