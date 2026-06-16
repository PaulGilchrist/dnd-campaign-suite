import { useState } from 'react';
import { confirmFiendishLegacy } from '../../../services/automation/handlers/class-other/fiendishLegacyHandler.js';
import '../CharSheet.css';

const FIENDISH_LEGACIES = [
    { name: 'Abyssal', description: 'Resistance to Poison damage + Poison Spray cantrip. Level 3: Ray of Sickness. Level 5: Hold Person.', spellcastingAbility: 'Charisma', icon: 'fa-dragon' },
    { name: 'Chthonic', description: 'Resistance to Necrotic damage + Chill Touch cantrip. Level 3: False Life. Level 5: Ray of Enfeeblement.', spellcastingAbility: 'Charisma', icon: 'fa-ghost' },
    { name: 'Infernal', description: 'Resistance to Fire damage + Fire Bolt cantrip. Level 3: Hellish Rebuke. Level 5: Darkness.', spellcastingAbility: 'Charisma', icon: 'fa-fire' },
];

function FiendishLegacyModal({ action: _action, playerStats, campaignName, onClose }) {
    const [selected, setSelected] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const handleApply = async () => {
        if (!selected) return;
        const res = await confirmFiendishLegacy(playerStats, selected, campaignName);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-dragon"></i> Fiendish Legacy
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
                    <i className="fa-solid fa-dragon"></i> Fiendish Legacy
                </div>
                <div className="sp-body">
                    <p>Choose a fiendish legacy (this choice determines your racial spellcasting ability and granted spells):</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {FIENDISH_LEGACIES.map((opt, i) => {
                            const isSelected = selected === opt.name;
                            return (
                                <label key={i} style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent', border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                                    <input
                                        type="radio"
                                        name="fiendishLegacyOption"
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
                        <i className="fa-solid fa-dragon"></i> Select Legacy
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default FiendishLegacyModal;
