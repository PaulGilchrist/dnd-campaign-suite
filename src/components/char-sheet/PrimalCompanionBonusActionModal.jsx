import { useState } from 'react';
import { applyBonusActionCommand } from '../../services/automation/handlers/class-ranger/primalCompanionHandler.js';
import './CharSheet.css';

const BONUS_ACTION_COMMANDS = [
    { name: 'Dash', description: 'Double movement speed this turn' },
    { name: 'Disengage', description: 'Movement doesn\'t trigger opportunity attacks' },
    { name: 'Dodge', description: 'Attackers have disadvantage against the companion' },
    { name: 'Help', description: 'Next ally attack against a target has advantage' },
];

function PrimalCompanionBonusActionModal({ action, playerStats, campaignName, companionType, onClose }) {
    const [selected, setSelected] = useState(null);
    const [useForceDamage, setUseForceDamage] = useState(false);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const canUseForceDamage = action.automation?.forceDamageOption;

    const handleApply = async () => {
        if (!selected) return;
        const res = await applyBonusActionCommand(action, playerStats, campaignName, selected, useForceDamage);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-hands"></i> {action.name}
                    </div>
                    <div className="sp-body" dangerouslySetInnerHTML={{ __html: result.payload.description }}>
                    </div>
                    <div className="sp-actions">
                        <button className="sp-roll-btn" onClick={onClose}>Done</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-hands"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p>Command your <b>{companionType}</b> to take a Bonus Action:</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {BONUS_ACTION_COMMANDS.map((cmd, i) => {
                            const isSelected = selected === cmd.name;
                            return (
                                <label key={i} style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent', border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                                    <input
                                        type="radio"
                                        name="primalCompanionBonusAction"
                                        checked={isSelected}
                                        onChange={() => setSelected(cmd.name)}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <strong>{cmd.name}</strong>
                                    <span style={{ opacity: 0.8, marginLeft: '8px' }}>— {cmd.description}</span>
                                </label>
                            );
                        })}
                    </div>
                    {canUseForceDamage && (
                        <div style={{ marginTop: '16px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={useForceDamage}
                                    onChange={() => setUseForceDamage(!useForceDamage)}
                                    style={{ marginRight: '8px' }}
                                />
                                <span>Deal Force damage instead of normal damage type</span>
                            </label>
                        </div>
                    )}
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleApply} disabled={!selected}>
                        <i className="fa-solid fa-hands"></i> Command Companion
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default PrimalCompanionBonusActionModal;
