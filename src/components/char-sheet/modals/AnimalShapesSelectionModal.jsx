import React from 'react';
import { loadMonsters } from '../../../services/ui/dataLoader.js';
import './AnimalShapesSelectionModal.css';

function parseChallengeRating(crString) {
    if (!crString) return 0;
    if (crString.includes('/')) {
        const parts = crString.split('/');
        return parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    return parseFloat(crString) || 0;
}

function formatSpeed(speeds) {
    const parts = [];
    if (speeds?.walk) parts.push(`Walk ${speeds.walk}`);
    if (speeds?.climb) parts.push(`Climb ${speeds.climb}`);
    if (speeds?.swim) parts.push(`Swim ${speeds.swim}`);
    if (speeds?.fly) parts.push(`Fly ${speeds.fly}`);
    return parts.join(', ');
}

function getBeastActionsSummary(actions) {
    if (!actions || actions.length === 0) return 'No actions';
    return actions.map(a => a.name).join(', ');
}

function getBeastImageUrl(beast) {
    return `https://paulgilchrist.github.io/dnd-tools/images/${beast.index}.jpg`;
}

function AnimalShapesSelectionModal({ targets, maxCR, campaignName, title = 'Animal Shapes', icon = 'fa-paw', onConfirm, onCancel }) {
    const [beasts, setBeasts] = React.useState([]);
    const [selectedBeasts, setSelectedBeasts] = React.useState({});
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [searchTerms, setSearchTerms] = React.useState({});

    React.useEffect(() => {
        async function loadBeasts() {
            try {
                const allMonsters = await loadMonsters();
                let creatureList = allMonsters.filter(m => m.type && m.type.toLowerCase() === 'beast');

                creatureList = creatureList.filter(m => {
                    const cr = parseChallengeRating(m.challenge_rating);
                    return cr <= (maxCR || 4);
                });

                const allowedSizes = ['Small', 'Large'];
                creatureList = creatureList.filter(m => {
                    const size = (m.size || '').toLowerCase();
                    return allowedSizes.some(s => s.toLowerCase() === size);
                });

                creatureList = creatureList.sort((a, b) => {
                    const crA = parseChallengeRating(a.challenge_rating);
                    const crB = parseChallengeRating(b.challenge_rating);
                    if (crA !== crB) return crA - crB;
                    return a.name.localeCompare(b.name);
                });

                setBeasts(creatureList);
            } catch (err) {
                console.error('[AnimalShapesSelectionModal] Error loading beasts:', err);
                setError('Failed to load creature data.');
            } finally {
                setLoading(false);
            }
        }
        loadBeasts();
    }, [maxCR, campaignName]);

    const handleSelect = (targetName, beast) => {
        setSelectedBeasts(prev => {
            const next = { ...prev };
            if (next[targetName]?.index === beast.index) {
                const copy = { ...next };
                delete copy[targetName];
                return copy;
            }
            return { ...next, [targetName]: beast };
        });
    };

    const handleSearchChange = (targetName, term) => {
        setSearchTerms(prev => ({ ...prev, [targetName]: term }));
    };

    const getFilteredBeasts = (targetName) => {
        const term = searchTerms[targetName]?.toLowerCase() || '';
        if (!term) return beasts;
        return beasts.filter(b => b.name.toLowerCase().includes(term));
    };

    const handleConfirm = () => {
        const targetBeastMap = {};
        for (const targetName of targets) {
            if (selectedBeasts[targetName]) {
                targetBeastMap[targetName] = selectedBeasts[targetName];
            }
        }
        if (Object.keys(targetBeastMap).length === 0) return;
        onConfirm(targetBeastMap);
    };

    React.useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onCancel() };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onCancel]);

    if (loading) {
        return (
            <div className="sp-overlay sp-overlay--evasion">
                <div className="sp-modal">
                    <div className="sp-header"><i className={`fa-solid ${icon}`}></i> {title}</div>
                    <div className="sp-body"><p>Loading available creatures...</p></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="sp-overlay sp-overlay--evasion">
                <div className="sp-modal">
                    <div className="sp-header"><i className={`fa-solid ${icon}`}></i> {title}</div>
                    <div className="sp-body"><p className="sp-note">{error}</p></div>
                    <div className="sp-actions">
                        <button className="sp-dismiss-btn" onClick={onCancel}>Close</button>
                    </div>
                </div>
            </div>
        );
    }

    const allSelected = targets.length > 0 && targets.every(t => selectedBeasts[t]);
    const selectedCount = Object.keys(selectedBeasts).length;

    return (
        <div className="sp-overlay sp-overlay--evasion">
            <div className="sp-modal">
                <div className="sp-header"><i className={`fa-solid ${icon}`}></i> {title}</div>
                <div className="sp-body">
                    <p>Choose a beast form (CR {maxCR || 4} or lower, Small or Large) for each target:</p>
                    <div className="animal-shapes-target-sections">
                        {targets.map((targetName) => {
                            const filtered = getFilteredBeasts(targetName);
                            const isSelected = selectedBeasts[targetName];
                            return (
                                <div key={targetName} className="animal-shapes-target-section">
                                    <div className="animal-shapes-target-header">
                                        <i className="fa-solid fa-paw"></i> {targetName}
                                        {isSelected && (
                                            <span className="animal-shapes-selected-badge">
                                                <i className="fa-solid fa-check"></i> {isSelected.name}
                                            </span>
                                        )}
                                    </div>
                                    <div className="animal-shapes-search">
                                        <input
                                            type="text"
                                            placeholder={`Search beasts for ${targetName}...`}
                                            value={searchTerms[targetName] || ''}
                                            onChange={(e) => handleSearchChange(targetName, e.target.value)}
                                        />
                                    </div>
                                    <div className="animal-shapes-beast-list">
                                        {filtered.length === 0 ? (
                                            <p className="sp-note">No beasts match.</p>
                                        ) : (
                                            filtered.map((beast) => {
                                                const cr = parseChallengeRating(beast.challenge_rating);
                                                const isSelectedForTarget = selectedBeasts[targetName]?.index === beast.index;
                                                const beastSpeeds = beast.speed || {};

                                                return (
                                                    <div
                                                        key={beast.index}
                                                        className={`animal-shapes-beast-item ${isSelectedForTarget ? 'selected' : ''}`}
                                                        onClick={() => handleSelect(targetName, beast)}
                                                    >
                                                        <div className="animal-shapes-beast-avatar">
                                                            <img
                                                                src={getBeastImageUrl(beast)}
                                                                alt={beast.name}
                                                                onError={(e) => { e.target.style.display = 'none'; }}
                                                            />
                                                        </div>
                                                        <div className="animal-shapes-beast-info">
                                                            <div className="animal-shapes-beast-name">
                                                                {beast.name}
                                                                <span className="animal-shapes-beast-cr">CR {cr}</span>
                                                                <span className="animal-shapes-beast-size">{beast.size}</span>
                                                            </div>
                                                            <div className="animal-shapes-beast-stats">
                                                                {formatSpeed(beastSpeeds)}
                                                            </div>
                                                            <div className="animal-shapes-beast-actions">
                                                                {getBeastActionsSummary(beast.actions)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-dismiss-btn" onClick={onCancel}>Cancel</button>
                    <button
                        className="sp-roll-btn"
                        onClick={handleConfirm}
                        disabled={!allSelected}
                    >
                        <i className={`fa-solid ${icon}`}></i> Transform ({selectedCount}/{targets.length})
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AnimalShapesSelectionModal;
