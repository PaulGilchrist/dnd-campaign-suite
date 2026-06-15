import { useState } from 'react';
import { onTamedSurgeSelected } from '../../services/automation/handlers/class-sorcerer/wildMagicSurgeHandler.js';
import './CharSheet.css';

function WildMagicTamedModal({ featureName, availableSurges, campaignName, playerStats, onClose }) {
    const [result, setResult] = useState(null);

    const handleSelect = async (surge) => {
        const res = await onTamedSurgeSelected(
            { name: featureName, automation: { type: 'wild_magic_tamed' } },
            playerStats || { name: 'Player' },
            campaignName,
            surge
        );
        setResult(res);
    };

    if (result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-bolt"></i> {featureName}
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
                    <i className="fa-solid fa-bolt"></i> {featureName}
                </div>
                <div className="sp-body">
                    <p><b>Tamed Surge — Choose your effect:</b></p>
                    <p>Choose one effect from the Wild Magic Surge table (excluding the final row).</p>
                    <div style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '8px' }}>
                        {availableSurges.map((surge, idx) => (
                            <button
                                key={idx}
                                className="sp-roll-btn"
                                onClick={() => handleSelect(surge)}
                                style={{ display: 'block', width: '100%', margin: '4px 0', textAlign: 'left', fontSize: '12px' }}
                            >
                                {surge.effect.substring(0, 120)}{surge.effect.length > 120 ? '...' : ''}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default WildMagicTamedModal;
