import { useRef, useState } from 'react';
import { applySoulstitchSelection } from '../../../../services/automation/handlers/class-wizard/soulstitchSpellsHandler.js';
import { confirmSoulstitchSelection } from '../../../../services/rules/spells/postCastRiderService.js';
import '../../CharSheet.css';
import './SoulstitchSpellsModal.css';
import { useOverlayEntranceFocus } from '../../../../hooks/ui/useOverlayEntranceFocus.js';

function SoulstitchSpellsModal({ action, playerStats, campaignName, maxSelections = 1, eligibleTargets = [], spellName = 'Unknown', featureName = 'Soulstitch Spells', onClose }) {
    const [selected, setSelected] = useState([]);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);
    // Entrance focus + stranded-close restore (backlog 2026-11-17 sp-overlay adoption).
    const overlayRef = useRef(null);
    useOverlayEntranceFocus(overlayRef);

    const handleToggle = (name) => {
        if (selected.includes(name)) {
            setSelected(selected.filter(n => n !== name));
        } else if (selected.length < maxSelections) {
            setSelected([...selected, name]);
        }
    };

    const handleApply = async () => {
        // CLA-321: single writer — this modal applies the stamp, then releases the cast.
        const res = await applySoulstitchSelection(action, playerStats, campaignName, selected);
        confirmSoulstitchSelection(selected);
        setResult(res);
        setApplied(true);
    };

    const handleClose = () => {
        // CLA-321: closing without applying is a decline — resolve the cast with an empty selection.
        if (!applied) {
            confirmSoulstitchSelection([]);
        }
        onClose?.();
    };

    if (applied && result) {
        return (
            <div className="sp-overlay soulstitch-result-overlay" ref={overlayRef}>
                <div className="sp-modal">
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
        <div className="sp-overlay" ref={overlayRef}>
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-shield-halved"></i> {featureName}
                </div>
                <div className="sp-body">
                    <p>Cast <strong>{spellName}</strong>. Choose up to <strong>{maxSelections}</strong> creature(s) you can see to automatically succeed on saving throws and take no damage.</p>
                    <p className="soulstitch-spells-selected-count">Selected: {selected.length} / {maxSelections}</p>
                    <div className="soulstitch-spells-target-list">
                        {eligibleTargets.map((name) => {
                            const isSelected = selected.includes(name);
                            return (
                                <label key={name} className={`soulstitch-spells-target${isSelected ? ' soulstitch-spells-target-selected' : ''}`} title={selected.length >= maxSelections && !isSelected ? `You can choose up to ${maxSelections} creatures` : undefined}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleToggle(name)}
                                        disabled={selected.length >= maxSelections && !isSelected}
                                    />
                                    <strong>{name}</strong>
                                </label>
                            );
                        })}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleApply} disabled={selected.length === 0}>
                        <i className="fa-solid fa-shield-halved"></i> Apply Soulstitch ({selected.length} chosen)
                    </button>
                    <button className="sp-dismiss-btn" onClick={handleClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default SoulstitchSpellsModal;
