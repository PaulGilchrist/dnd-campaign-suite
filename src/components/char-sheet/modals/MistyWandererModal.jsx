import { useState } from 'react';
import { confirmMistyWanderer } from '../../../services/automation/handlers/class-warlock/mistyWandererHandler.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import '../CharSheet.css';
import './MistyWandererModal.css';

// CLA-229: populate the companion select from the live combatSummary — every
// combatant except the caster is a candidate willing creature (gridless
// encounters skip the 5-ft range check by app convention; mirrors the
// ally-picker population used by CreatureSelectionModal/Invoke Duplicity).
function getCompanionOptions(playerStats, campaignName) {
    const combatSummary = getCombatSummary(campaignName);
    const creatures = Array.isArray(combatSummary?.creatures) ? combatSummary.creatures : [];
    return creatures.filter(c => c?.name && c.name !== playerStats?.name);
}

function MistyWandererModal({ action, playerStats, campaignName, usesMax, onClose }) {
    const [selectedAlly, setSelectedAlly] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const companions = getCompanionOptions(playerStats, campaignName);
    const featureName = action?.name || 'Misty Wanderer';
    const freeCastCountKey = `_${featureName.replace(/\s+/g, '_')}_freeCastCount`;
    const max = usesMax || 1;
    const remaining = Number(getRuntimeValue(playerStats?.name, freeCastCountKey, campaignName) ?? max);

    const handleConfirm = async () => {
        const res = await confirmMistyWanderer(action, playerStats, campaignName, !!selectedAlly, selectedAlly);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay">
                <div className="sp-modal">
                    <div className="sp-header">
                        <i className="fa-solid fa-cloud"></i> {action.name}
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
        <div className="sp-overlay">
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-cloud"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p>Cast <strong>Misty Step</strong> — teleport up to 30 feet to an unoccupied space you can see.</p>
                    <p className="misty-wanderer-uses">Free casts remaining: {remaining} / {max}</p>
                    <div className="misty-wanderer-companion">
                        <p>Bring a willing creature within 5 feet?</p>
                        <select
                            className="misty-wanderer-ally-select"
                            value={selectedAlly || ''}
                            onChange={e => setSelectedAlly(e.target.value || null)}
                        >
                            <option value="">None</option>
                            {companions.map(c => (
                                <option key={c.name} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                        <p className="misty-wanderer-hint">
                            The creature appears in an unoccupied space within 5 feet of your destination.
                        </p>
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleConfirm}>
                        <i className="fa-solid fa-cloud"></i> Cast Misty Step
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default MistyWandererModal;
