import { useState } from 'react';
import { confirmElfisLineage } from '../../../services/automation/handlers/class-other/elfishLineageHandler.js';
import '../CharSheet.css';

const ELVEN_LINEAGES = [
    { name: 'Drow', description: 'Darkvision 120 ft. + Dancing Lights cantrip. Level 3: Faerie Fire. Level 5: Darkness.', spellcastingAbility: 'Charisma', icon: 'fa-d' },
    { name: 'High Elf', description: 'Prestidigitation cantrip (swappable with Wizard cantrips on Long Rest). Level 3: Detect Magic. Level 5: Misty Step.', spellcastingAbility: 'Intelligence', icon: 'fa-star' },
    { name: 'Wood Elf', description: 'Speed 35 ft. + Druidcraft cantrip. Level 3: Longstrider. Level 5: Pass Without Trace.', spellcastingAbility: 'Wisdom', icon: 'fa-tree' },
];

function ElfisLineageModal({ action: _action, playerStats, campaignName, onClose }) {
    const [selected, setSelected] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const handleApply = async () => {
        if (!selected) return;
        const res = await confirmElfisLineage(playerStats, selected, campaignName);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-dragon"></i> Elfish Lineage
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
                    <i className="fa-solid fa-dragon"></i> Elfish Lineage
                </div>
                <div className="sp-body">
                    <p>Choose an elven lineage (this choice determines your racial spellcasting ability and granted spells):</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {ELVEN_LINEAGES.map((opt, i) => {
                            const isSelected = selected === opt.name;
                            return (
                                <label key={i} style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent', border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                                    <input
                                        type="radio"
                                        name="elfishLineageOption"
                                        checked={isSelected}
                                        onChange={() => setSelected(opt.name)}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <strong><i className={`fa-solid ${opt.icon}`}></i> {opt.name}</strong>
                                    <span style={{ opacity: 0.8, marginLeft: '8px' }}>— {opt.description}</span>
                                    <br />
                                    <span style={{ opacity: 0.6, marginLeft: '28px', fontSize: '0.85em' }}>Spellcasting ability: {opt.spellcastingAbility}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleApply} disabled={!selected}>
                        <i className="fa-solid fa-dragon"></i> Select Lineage
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default ElfisLineageModal;
