import { useState, useEffect } from 'react';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../../services/dice/diceRoller.js';
import './BastionOfLawModal.css';

function BastionOfLawModal({ featureName, targetName, playerName, campaignName, auto, onClose, onConfirm }) {
    const [spAmount, setSpAmount] = useState(1);
    const [mode, setMode] = useState('activate');
    const [wardDice, setWardDice] = useState([]);
    const [diceToSpend, setDiceToSpend] = useState(1);
    const [rollResult, setRollResult] = useState(null);

    const maxSP = auto?.maxSP || 5;
    const minSP = auto?.minSP || 1;

    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    // Check current sorcery points and ward state
    useEffect(() => {
        const spPool = getRuntimeValue(playerName, 'sorceryPoints', campaignName);
        const spMax = 10;
        const spCurrent = Number(spPool) ?? spMax;
        const maxSpendable = Math.min(maxSP, spCurrent);
        setSpAmount(Math.max(minSP, Math.min(maxSpendable, spAmount)));

        const currentWard = getRuntimeValue(playerName, 'bastionOfLawWardDice', campaignName) || [];
        setWardDice(currentWard);
    }, [playerName, campaignName, maxSP, minSP, spAmount]);

    const handleActivate = async () => {
        if (onConfirm) {
            const result = await onConfirm(spAmount, targetName);
            if (result?.type === 'popup') {
                // Check if it was successful
                if (result.payload?.description?.includes('Not enough')) {
                    return;
                }
            }
        }
        setMode('ward-active');
        const updatedWard = getRuntimeValue(playerName, 'bastionOfLawWardDice', campaignName) || [];
        setWardDice(updatedWard);
    };

    const handleSpendDice = async () => {
        const diceToRoll = Array(diceToSpend).fill('1d8');
        const rollResultData = rollExpression(diceToRoll.join('+'));
        const total = rollResultData?.total || 0;

        setRollResult({
            dice: diceToSpend,
            rolls: rollResultData?.rolls || [],
            total,
            remaining: Math.max(0, wardDice.length - diceToSpend),
        });

        if (onConfirm) {
            await onConfirm(null, null, diceToSpend);
        }

        setTimeout(() => setRollResult(null), 3000);
    };

    const handleClearWard = async () => {
        if (onConfirm) {
            await onConfirm(null, null, null, true);
        }
        setWardDice([]);
        setMode('activate');
    };

    if (mode === 'ward-active') {
        return (
            <div className="bastion-of-law-overlay no-print" onClick={onClose}>
                <div className="bastion-of-law-modal" onClick={(e) => e.stopPropagation()}>
                    <h3><i className="fas fa-shield-halved"></i> {featureName}</h3>
                    <p className="bastion-subtitle">Ward active on {targetName}</p>

                    <div className="bastion-section">
                        <h4>Ward Dice Pool</h4>
                        <div className="bastion-dice-display">
                            <span className="bastion-dice-count">{wardDice.length}d8</span>
                            <span className="bastion-dice-label">dice remaining</span>
                        </div>
                    </div>

                    {wardDice.length > 0 && (
                        <div className="bastion-section">
                            <h4>Spend Dice as Reaction</h4>
                            <p className="bastion-hint">When {targetName} takes damage, spend dice to reduce it.</p>
                            <div className="bastion-spend-controls">
                                <label>
                                    Dice to spend:
                                    <input
                                        type="number"
                                        min="1"
                                        max={wardDice.length}
                                        value={diceToSpend}
                                        onChange={(e) => setDiceToSpend(Math.max(1, Math.min(wardDice.length, Number(e.target.value) || 1)))}
                                    />
                                </label>
                                <button className="char-btn" onClick={handleSpendDice} disabled={wardDice.length === 0}>
                                    <i className="fas fa-dice"></i> Roll &amp; Reduce Damage
                                </button>
                            </div>
                        </div>
                    )}

                    {rollResult && (
                        <div className="bastion-section bastion-roll-result">
                            <h4><i className="fas fa-dice"></i> Roll Result</h4>
                            <div className="bastion-roll-details">
                                <span>{rollResult.dice}d8: [{rollResult.rolls.join(', ')}] = <strong>{rollResult.total}</strong></span>
                                <span className="bastion-remaining">Remaining: {rollResult.remaining}d8</span>
                            </div>
                        </div>
                    )}

                    <div className="bastion-actions">
                        <button className="char-btn" onClick={handleClearWard}>
                            <i className="fa-solid fa-xmark"></i> Clear Ward
                        </button>
                        <button className="char-btn" onClick={onClose}>
                            <i className="fa-solid fa-check"></i> Done
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bastion-of-law-overlay no-print" onClick={onClose}>
            <div className="bastion-of-law-modal" onClick={(e) => e.stopPropagation()}>
                <h3><i className="fas fa-shield-halved"></i> {featureName}</h3>
                <p className="bastion-subtitle">Target: {targetName}</p>

                <div className="bastion-section">
                    <h4>Spend Sorcery Points</h4>
                    <p className="bastion-hint">Each SP creates one d8 in the ward dice pool.</p>
                    <div className="bastion-sp-controls">
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
                        <button className="char-btn" onClick={handleActivate}>
                            <i className="fas fa-shield-halved"></i> Create Ward ({spAmount}d8)
                        </button>
                    </div>
                </div>

                <div className="bastion-section">
                    <h4>Ward Details</h4>
                    <ul className="bastion-details-list">
                        <li>Ward dice: {spAmount}d8</li>
                        <li>Range: {auto?.range ? auto.range.replace('_ft', ' ft') : '30 ft'}</li>
                        <li>Duration: Long Rest or until used again</li>
                        <li>As a Reaction, spend dice when warded creature takes damage</li>
                    </ul>
                </div>

                <div className="bastion-actions">
                    <button className="char-btn" onClick={onClose}>
                        <i className="fa-solid fa-xmark"></i> Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

export default BastionOfLawModal;
