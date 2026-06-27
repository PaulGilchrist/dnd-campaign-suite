import { useState, useEffect } from 'react';
import { applyWeaponKindMastery } from '../../../services/automation/index.js';
import '../CharSheet.css';

let weaponsCache = null;

async function loadWeapons() {
    if (weaponsCache === null) {
        weaponsCache = await (await fetch('/data/equipment.json')).json();
    }
    return weaponsCache;
}

function WeaponKindMasteryModal({ action, playerStats, campaignName, meleeOnly, onClose, existing }) {
    const [selected, setSelected] = useState(existing || []);
    const [result, setResult] = useState(null);
    const [weapons, setWeapons] = useState([]);
    const [maxKinds, setMaxKinds] = useState(2);

    useEffect(() => {
        const auto = action?.automation || {};
        let mk = auto.maxKinds || 2;
        if (mk === 'class_level_scaling') {
            const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
            mk = classLevel?.weapon_mastery || 2;
        }
        setMaxKinds(mk);

        loadWeapons().then(allItems => {
            const weaponItems = allItems.filter(w =>
                w.equipment_category === 'Weapon' &&
                w.weapon_category &&
                w.weapon_range
            ).sort((a, b) => a.name.localeCompare(b.name));

            const filtered = meleeOnly
                ? weaponItems.filter(w => w.weapon_range === 'Melee')
                : weaponItems;

            setWeapons(filtered);
        }).catch((e) => { console.error("[WeaponKindMasteryModal] Error:", e); });
    }, [action, playerStats, meleeOnly]);

    const toggleWeapon = (weaponName) => {
        setSelected(prev => {
            if (prev.includes(weaponName)) {
                return prev.filter(w => w !== weaponName);
            }
            if (prev.length >= maxKinds) {
                return prev;
            }
            return [...prev, weaponName];
        });
    };

    const handleSelect = async () => {
        if (selected.length === 0) return;
        const res = await applyWeaponKindMastery(selected, playerStats, campaignName);
        setResult(res);
    };

    if (result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-crosshairs"></i> Weapon Mastery
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
                    <i className="fa-solid fa-crosshairs"></i> Weapon Mastery — Choose Weapon Kinds
                </div>
                <div className="sp-body">
                    <p>Choose up to <b>{maxKinds}</b> weapon{maxKinds > 1 ? 's' : ''} to apply Weapon Mastery{meleeOnly ? ' (Melee only)' : ''}:</p>
                    <div style={{ maxHeight: '400px', overflowY: 'auto', textAlign: 'left', marginTop: '12px' }}>
                        {weapons.map((weapon, i) => {
                            const isSelected = selected.includes(weapon.name);
                            return (
                                <label key={i} style={{
                                    display: 'block', padding: '6px 12px', margin: '2px 0',
                                    borderRadius: '4px', cursor: selected.length >= maxKinds && !isSelected ? 'not-allowed' : 'pointer',
                                    background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent',
                                    border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent',
                                    opacity: selected.length >= maxKinds && !isSelected ? 0.5 : 1,
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleWeapon(weapon.name)}
                                        disabled={selected.length >= maxKinds && !isSelected}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <strong>{weapon.name}</strong>
                                    <span style={{ marginLeft: '8px', fontSize: '0.85em', opacity: 0.7 }}>
                                        [{weapon.weapon_category} {weapon.weapon_range}]
                                    </span>
                                    <span style={{ marginLeft: '8px', fontSize: '0.85em', opacity: 0.7 }}>
                                        Mastery: {weapon.mastery || '—'}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                    <p style={{ opacity: 0.7, fontSize: '0.85em', marginTop: '8px' }}>
                        Selected: {selected.length}/{maxKinds}
                    </p>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleSelect} disabled={selected.length === 0}>
                        <i className="fa-solid fa-check"></i> Select
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Skip</button>
                </div>
            </div>
        </div>
    );
}

export default WeaponKindMasteryModal;
