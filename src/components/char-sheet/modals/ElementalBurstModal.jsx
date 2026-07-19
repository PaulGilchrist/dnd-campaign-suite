import React, { useState, useCallback } from 'react';
import { addEntry } from '../../../services/ui/logService.js';
import SaveAttackAoeModal from './shared/SaveAttackAoeModal.jsx';

const DAMAGE_TYPES = [
    { name: 'Acid', icon: 'fa-leaf' },
    { name: 'Cold', icon: 'fa-snowflake' },
    { name: 'Fire', icon: 'fa-fire' },
    { name: 'Lightning', icon: 'fa-bolt' },
    { name: 'Thunder', icon: 'fa-volume-high' },
];

function resolveMartialArtsDie(playerStats) {
    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
    return classLevel?.martial_arts_die || 4;
}

function ElementalBurstModal({ action, playerStats, campaignName, onClose }) {
    const [phase, setPhase] = useState('element');
    const [aoePayload, setAoePayload] = useState(null);

    const martialArtsDie = resolveMartialArtsDie(playerStats);
    const resolvedDamage = `3d${martialArtsDie}`;

    const handleTypeChoice = useCallback(async (typeName) => {
        setPhase('processing');

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            description: `${action.name}: Chose ${typeName} damage type.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[ElementalBurstModal] Error logging type choice:', e); });

        const saveDc = 8 + (playerStats.abilities?.find(a => a.name === 'Dexterity')?.bonus || 0) + playerStats.proficiency;

        const payload = {
            action,
            playerStats,
            campaignName,
            shape: 'sphere',
            range: 20,
            damage: resolvedDamage,
            damageType: typeName.toLowerCase(),
            saveType: 'DEX',
            saveDc,
            dcSuccess: 'half',
        };

        setAoePayload(payload);
        setPhase('aoe');
    }, [action, playerStats, campaignName, resolvedDamage]);

    const handleAoeClose = useCallback(() => {
        onClose();
    }, [onClose]);

    if (phase === 'element') {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-wand-magic-sparkles"></i> Elemental Burst
                    </div>
                    <div className="sp-body">
                        <p>Choose a damage type for the elemental burst. Each creature in a 20-foot-radius sphere within 120 feet must make a Dexterity saving throw (DC {8 + (playerStats.abilities?.find(a => a.name === 'Dexterity')?.bonus || 0) + playerStats.proficiency}).</p>
                        <p className="sp-note">On a failed save, a creature takes 3d{martialArtsDie} damage of the chosen type. On a successful save, a creature takes half as much damage.</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                            {DAMAGE_TYPES.map(({ name, icon }) => (
                                <button
                                    key={name}
                                    className="sp-roll-btn"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px 16px',
                                        textAlign: 'left',
                                        margin: '0',
                                    }}
                                    onClick={() => handleTypeChoice(name)}
                                >
                                    <i className={`fa-solid ${icon}`} style={{ fontSize: '1.4em', width: '30px', textAlign: 'center' }}></i>
                                    <div>
                                        <strong>{name}</strong>
                                    </div>
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

    if (phase === 'aoe' && aoePayload) {
        return (
            <SaveAttackAoeModal
                {...aoePayload}
                onClose={handleAoeClose}
            />
        );
    }

    return null;
}

export default ElementalBurstModal;
