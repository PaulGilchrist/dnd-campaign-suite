import { useState } from 'react';
import { confirmGnomishLineage } from '../../../services/automation/handlers/class-other/gnomishLineageHandler.js';
import '../CharSheet.css';

const GNOME_LINEAGES = [
    { name: 'Deep Gnome', description: 'Darkvision 120 ft. + Magic Stone cantrip. Level 3: Nondetection. Level 5: Passwall.', spellcastingAbility: 'Intelligence', icon: 'fa-eye' },
    { name: 'Forest Gnome', description: 'Hide behind larger creatures + Minor Illusion cantrip. Level 3: Speak with Animals. Level 5: Call Lightning.', spellcastingAbility: 'Intelligence', icon: 'fa-tree' },
    { name: 'Rock Gnome', description: 'Move through larger creatures\' space + Mending cantrip. Level 3: Prestidigitation. Level 5: Protection from Energy.', spellcastingAbility: 'Intelligence', icon: 'fa-hammer' },
];

function GnomishLineageModal({ action: _action, playerStats, campaignName, onClose }) {
    const [selected, setSelected] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const handleApply = async () => {
        if (!selected) return;
        const res = await confirmGnomishLineage(playerStats, selected, campaignName);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-dragon"></i> Gnomish Lineage
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
                    <i className="fa-solid fa-dragon"></i> Gnomish Lineage
                </div>
                <div className="sp-body">
                    <p>Choose a gnomish lineage (this choice determines your racial spellcasting ability and granted spells):</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {GNOME_LINEAGES.map((opt, i) => {
                            const isSelected = selected === opt.name;
                            return (
                                <label key={i} style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent', border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                                    <input
                                        type="radio"
                                        name="gnomishLineageOption"
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

export default GnomishLineageModal;
