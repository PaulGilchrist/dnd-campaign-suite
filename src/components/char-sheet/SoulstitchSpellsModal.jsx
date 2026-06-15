import { useState } from 'react';
import { applySoulstitchSelection } from '../../services/automation/handlers/class-wizard/soulstitchSpellsHandler.js';
import './CharSheet.css';

function SoulstitchSpellsModal({ action, playerStats, campaignName, onClose }) {
    const [selected, setSelected] = useState([]);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const maxSelections = action?.maxSelections || 1;
    const eligibleTargets = action?.eligibleTargets || [];
    const spellName = action?.spellName || 'Unknown';
    const featureName = action?.featureName || 'Soulstitch Spells';
    const existingChosen = action?.chosenCreatures || [];

    const handleToggle = (name) => {
        if (selected.includes(name)) {
            setSelected(selected.filter(n => n !== name));
        } else if (selected.length < maxSelections) {
            setSelected([...selected, name]);
        }
    };

    const handleApply = async () => {
        const res = await applySoulstitchSelection(action, playerStats, campaignName, selected);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-shield-halved"></i> {featureName}
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
                    <i className="fa-solid fa-shield-halved"></i> {featureName}
                </div>
                <div className="sp-body">
                    <p>Cast <strong>{spellName}</strong>. Choose up to <strong>{maxSelections}</strong> creature(s) you can see to automatically succeed on saving throws and take no damage.</p>
                    <p style={{ fontSize: '0.9em', opacity: 0.8, marginTop: '4px' }}>Selected: {selected.length} / {maxSelections}</p>
                    <div style={{ textAlign: 'left', marginTop: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                        {eligibleTargets.map((name, i) => {
                            const isSelected = selected.includes(name);
                            const wasPreviouslyChosen = existingChosen.includes(name);
                            return (
                                <label key={i} style={{ display: 'block', padding: '6px 12px', margin: '2px 0', borderRadius: '6px', cursor: selected.length >= maxSelections && !isSelected ? 'not-allowed' : 'pointer', background: isSelected ? 'rgba(255,255,255,0.15)' : (wasPreviouslyChosen && !isSelected ? 'rgba(100,200,255,0.1)' : 'transparent'), border: isSelected ? '1px solid var(--color-link)' : (wasPreviouslyChosen && !isSelected ? '1px dashed var(--color-link)' : '1px solid transparent'), opacity: selected.length >= maxSelections && !isSelected ? 0.5 : 1 }}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleToggle(name)}
                                        disabled={selected.length >= maxSelections && !isSelected}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <strong>{name}</strong>
                                    {wasPreviouslyChosen && !isSelected && <span style={{ marginLeft: '8px', opacity: 0.7, fontSize: '0.85em' }}>(previously chosen)</span>}
                                </label>
                            );
                        })}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleApply} disabled={selected.length === 0}>
                        <i className="fa-solid fa-shield-halved"></i> Apply Soulstitch ({selected.length} chosen)
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default SoulstitchSpellsModal;
