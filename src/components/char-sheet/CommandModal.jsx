import React, { useState } from 'react';
import { triggerCommand } from '../../services/rules/features/commandService.js';
import './CommandModal.css';

const COMMAND_OPTIONS = [
    { value: 'Approach', label: 'Approach', description: 'Target moves toward you by the shortest route, ending turn within 5 ft' },
    { value: 'Drop', label: 'Drop', description: 'Target drops held items and ends turn' },
    { value: 'Flee', label: 'Flee', description: 'Target spends turn moving away from you by fastest means' },
    { value: 'Grovel', label: 'Grovel', description: 'Target falls prone and ends turn' },
    { value: 'Halt', label: 'Halt', description: 'Target doesn\'t move or take actions on its next turn' },
];

function CommandModal({ spell, metaCtx, targetName, playerStats, campaignName, mapName, onClose }) {
    const [selectedCommand, setSelectedCommand] = useState('Approach');
    const [casting, setCasting] = useState(false);

    const handleCast = async () => {
        if (casting) return;
        setCasting(true);

        try {
            const targetInfo = targetName ? { name: targetName } : null;
            const result = await triggerCommand({
                spell,
                commandChoice: selectedCommand,
                targetInfo,
                metaCtx,
                playerStats,
                campaignName,
                mapName,
            });

            if (result?.type === 'popup') {
                onClose();
            }
        } catch (e) {
            console.error('[CommandModal] Error casting Command:', e);
            onClose();
        } finally {
            setCasting(false);
        }
    };

    return (
        <div className="command-overlay" onClick={onClose}>
            <div className="command-modal" onClick={(e) => e.stopPropagation()}>
                <h3>
                    <i className="fa-solid fa-volume-high"></i> Command
                </h3>
                <p className="command-description">
                    Choose a one-word command for the target to follow on its next turn.
                    The target must succeed on a WIS save (DC {metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || '—'}) or follow the command.
                </p>

                <div className="command-options">
                    {COMMAND_OPTIONS.map((option) => (
                        <label
                            key={option.value}
                            className={`command-option ${selectedCommand === option.value ? 'selected' : ''}`}
                        >
                            <input
                                type="radio"
                                name="commandChoice"
                                value={option.value}
                                checked={selectedCommand === option.value}
                                onChange={() => setSelectedCommand(option.value)}
                            />
                            <div className="command-option-content">
                                <span className="command-option-label">{option.label}</span>
                                <span className="command-option-description">{option.description}</span>
                            </div>
                        </label>
                    ))}
                </div>

                <div className="command-actions">
                    <button
                        className="char-btn"
                        onClick={handleCast}
                        disabled={casting}
                    >
                        <i className="fa-solid fa-hands"></i>
                        {casting ? 'Casting...' : 'Cast Spell'}
                    </button>
                    <button
                        className="char-btn"
                        onClick={onClose}
                        disabled={casting}
                    >
                        <i className="fa-solid fa-times"></i> Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CommandModal;
