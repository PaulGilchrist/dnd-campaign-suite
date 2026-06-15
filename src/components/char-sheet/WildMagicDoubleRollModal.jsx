import { useState } from 'react';
import { onDoubleRollSelected } from '../../services/automation/handlers/class-sorcerer/wildMagicSurgeHandler.js';
import './CharSheet.css';

function WildMagicDoubleRollModal({ featureName, roll1, roll2, surgeTable, campaignName, playerStats, onClose }) {
    const [result, setResult] = useState(null);

    const surge1 = surgeTable.find(e => roll1 >= e.min && roll1 <= e.max);
    const surge2 = surgeTable.find(e => roll2 >= e.min && roll2 <= e.max);

    const handleSelect = async (selectedRoll) => {
        const res = await onDoubleRollSelected(
            { featureName, surgeTable },
            playerStats || { name: 'Player' },
            campaignName,
            selectedRoll
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
                    <p><b>Controlled Chaos — Choose your roll:</b></p>
                    <p>
                        <button className="sp-roll-btn" onClick={() => handleSelect(roll1)} style={{ margin: '4px' }}>
                            Roll 1: {roll1}
                            {surge1 ? ` — ${surge1.effect.substring(0, 80)}...` : ''}
                        </button>
                        <button className="sp-roll-btn" onClick={() => handleSelect(roll2)} style={{ margin: '4px' }}>
                            Roll 2: {roll2}
                            {surge2 ? ` — ${surge2.effect.substring(0, 80)}...` : ''}
                        </button>
                    </p>
                </div>
                <div className="sp-actions">
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default WildMagicDoubleRollModal;
