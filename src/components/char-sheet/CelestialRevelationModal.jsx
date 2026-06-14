import { useState } from 'react';
import { confirmCelestialRevelation } from '../../services/automation/handlers/celestialRevelationHandler.js';
import './CharSheet.css';

const TRANSFORMATION_OPTIONS = [
    { name: 'Heavenly Wings', description: 'Two spectral wings sprout from your back. You gain a Fly Speed equal to your Speed.', icon: 'fa-feather-pointed', damageType: 'Radiant' },
    { name: 'Inner Radiance', description: 'Searing light radiates from your eyes and mouth. You shed Bright Light in a 10-foot radius and Dim Light for an additional 10 feet. Creatures within 10 feet take Radiant damage at the end of each of your turns.', icon: 'fa-sun', damageType: 'Radiant' },
    { name: 'Necrotic Shroud', description: 'Your eyes become pools of darkness, and flightless wings sprout from your back. Creatures within 10 feet (other than allies) must make a CHA saving throw or be Frightened until the end of your next turn.', icon: 'fa-skull', damageType: 'Necrotic' },
];

function CelestialRevelationModal({ action: _action, playerStats, campaignName, onClose }) {
    const [selected, setSelected] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const handleApply = async () => {
        if (!selected) return;
        const res = await confirmCelestialRevelation(playerStats, selected, campaignName);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-star"></i> Celestial Revelation
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
                    <i className="fa-solid fa-star"></i> Celestial Revelation
                </div>
                <div className="sp-body">
                    <p>Choose a transformation option (Bonus Action, once per Long Rest):</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {TRANSFORMATION_OPTIONS.map((opt, i) => {
                            const isSelected = selected === opt.name;
                            return (
                                <label key={i} style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent', border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                                    <input
                                        type="radio"
                                        name="celestialRevelationOption"
                                        checked={isSelected}
                                        onChange={() => setSelected(opt.name)}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <strong><i className={`fa-solid ${opt.icon}`}></i> {opt.name}</strong>
                                    <span style={{ opacity: 0.8, marginLeft: '8px' }}>— {opt.description}</span>
                                </label>
                            );
                        })}
                    </div>
                    <p style={{ marginTop: '12px', fontSize: '0.85em', opacity: 0.7 }}>
                        Extra damage: Proficiency Bonus ({playerStats.proficiency || 0}) of {selected ? TRANSFORMATION_OPTIONS.find(o => o.name === selected)?.damageType : '—'} type per turn during transformation.
                    </p>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleApply} disabled={!selected}>
                        <i className="fa-solid fa-star"></i> Transform
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default CelestialRevelationModal;
