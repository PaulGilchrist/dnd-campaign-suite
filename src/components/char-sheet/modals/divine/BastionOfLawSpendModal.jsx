import { useState } from 'react';
import { useRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../../services/dice/diceRoller.js';
import './BastionOfLawSpendModal.css';

function BastionOfLawSpendModal({ featureName, playerName, campaignName, onClose, onConfirm }) {
    const [rollResult, setRollResult] = useState(null);

    const wardDice = useRuntimeValue(playerName, 'bastionOfLawWardDice', campaignName) || [];
    const lastAttackDamage = useRuntimeValue(playerName, 'bastionOfLawLastAttackDamage', campaignName) || 0;
    const wardUsed = useRuntimeValue(playerName, 'bastionOfLawWardUsed', campaignName) || 0;
    const remainingDamage = Math.max(0, lastAttackDamage - wardUsed);

    const handleSpendDice = async () => {
        if (wardDice.length === 0) return;

        const rollResultData = rollExpression('1d8');
        const total = rollResultData?.total || 0;

        setRollResult({
            dice: 1,
            rolls: rollResultData?.rolls || [],
            total,
            remaining: Math.max(0, wardDice.length - 1),
        });

        if (onConfirm) {
            await onConfirm(1, rollResultData);
        }

        setTimeout(() => setRollResult(null), 3000);
    };

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-shield-halved"></i> {featureName}
                </div>
                <div className="sp-body">
                    <p>Your magical ward is active. When you take damage, spend dice from the ward to reduce it.</p>

                    <div className="bastion-spend-dice-display">
                        <span className="bastion-spend-dice-count">{wardDice.length}d8</span>
                        <span className="bastion-spend-dice-label">dice remaining</span>
                    </div>

                    <div className="bastion-damage-info">
                        <span>Total damage from last attack: {lastAttackDamage}</span>
                        <span>Ward already used: {wardUsed}</span>
                        <span>Remaining damage to ward: {remainingDamage}</span>
                    </div>

                    {wardDice.length > 0 && (
                        <div className="bastion-spend-controls">
                            <button className="sp-roll-btn" onClick={handleSpendDice} disabled={wardDice.length === 0}>
                                <i className="fa-solid fa-dice"></i> Roll &amp; Reduce Damage
                            </button>
                        </div>
                    )}

                    {rollResult && (
                        <div className="bastion-roll-result">
                            <div className="bastion-roll-details">
                                <span>{rollResult.dice}d8: [{rollResult.rolls.join(', ')}] = <strong>{rollResult.total}</strong></span>
                                <span className="bastion-remaining">Remaining: {rollResult.remaining}d8</span>
                            </div>
                        </div>
                    )}
                </div>
                <div className="sp-actions">
                    <button className="sp-dismiss-btn" onClick={onClose}>
                        <i className="fa-solid fa-check"></i> Done
                    </button>
                </div>
            </div>
        </div>
    );
}

export default BastionOfLawSpendModal;
