import React from 'react';
import { loadMonsters } from '../../../services/ui/dataLoader.js';
import { getClassFeatures } from '../../../services/character/classFeatures.js';
import './PolymorphSelectionModal.css';

function parseChallengeRating(crString) {
    if (!crString) return 0;
    if (crString.includes('/')) {
        const parts = crString.split('/');
        return parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    return parseFloat(crString) || 0;
}

function filterBeastSpeeds(beastSpeeds, limitations) {
    if (!beastSpeeds) return {};
    if (!limitations) return beastSpeeds;
    const filtered = {};
    if (beastSpeeds.walk) filtered.walk = beastSpeeds.walk;
    const hasFly = limitations.includes('fly');
    const hasSwim = limitations.includes('swim');
    if (beastSpeeds.swim && hasSwim) filtered.swim = beastSpeeds.swim;
    if (beastSpeeds.fly && hasFly) filtered.fly = beastSpeeds.fly;
    if (beastSpeeds.climb && hasSwim) filtered.climb = beastSpeeds.climb;
    if (beastSpeeds.burrow && hasSwim) filtered.burrow = beastSpeeds.burrow;
    return filtered;
}

function formatSpeed(speeds) {
    const parts = [];
    if (speeds.walk) parts.push(`Walk ${speeds.walk}`);
    if (speeds.climb) parts.push(`Climb ${speeds.climb}`);
    if (speeds.swim) parts.push(`Swim ${speeds.swim}`);
    if (speeds.fly) parts.push(`Fly ${speeds.fly}`);
    return parts.join(', ');
}

function getBeastActionsSummary(actions) {
    if (!actions || actions.length === 0) return 'No actions';
    return actions.map(a => a.name).join(', ');
}

function filterCreatureList(allMonsters, { allowAnyCreature, excludeTypes, mode, effectiveMaxCR, wildShapeLimitations }) {
    let creatureList = allMonsters;
    if (!allowAnyCreature) {
        creatureList = creatureList.filter(m => m.type && m.type.toLowerCase() === 'beast');
    }

    if (excludeTypes.length > 0) {
        const lowerExclude = excludeTypes.map(t => t.toLowerCase());
        creatureList = creatureList.filter(m => !lowerExclude.includes((m.type || '').toLowerCase()));
    }

    if (mode === 'object_into_creature') {
        creatureList = creatureList.filter(m => {
            const cr = parseChallengeRating(m.challenge_rating);
            return cr <= 9;
        });
    } else {
        creatureList = creatureList.filter(m => {
            const cr = parseChallengeRating(m.challenge_rating);
            return cr <= effectiveMaxCR;
        });
    }

    if (!allowAnyCreature) {
        creatureList = creatureList.filter(m => {
            if (!wildShapeLimitations) return true;
            const filteredSpeeds = filterBeastSpeeds(m.speed, wildShapeLimitations);
            return filteredSpeeds.walk;
        });
    }

    return creatureList.sort((a, b) => {
        const crA = parseChallengeRating(a.challenge_rating);
        const crB = parseChallengeRating(b.challenge_rating);
        if (crA !== crB) return crA - crB;
        return a.name.localeCompare(b.name);
    });
}

function computeListCopy({ allowAnyCreature, mode, effectiveMaxCR, wildShapeLimitations }) {
    const listLabel = allowAnyCreature
        ? (mode === 'object_into_creature' ? 'Choose a creature form (CR 9 or lower)' : `Choose a creature form (CR ${effectiveMaxCR} or lower)`)
        : `Choose a beast form (CR ${effectiveMaxCR} or lower)`;
    const searchPlaceholder = allowAnyCreature ? 'Search creatures...' : 'Search beasts...';
    const noResultsMsg = allowAnyCreature
        ? (mode === 'object_into_creature' ? 'No creatures match the CR 9 requirement.' : `No creatures match the target's CR requirement.`)
        : `No beasts match ${wildShapeLimitations ? 'your Wild Shape limitations' : 'the target\'s CR requirement'}.`;
    return { listLabel, searchPlaceholder, noResultsMsg };
}

function resolveWildShapeLimitations(playerStats) {
    if (!playerStats) return null;
    return getClassFeatures(playerStats)?.wildShapeLimitations || 'walk only (no swim or fly)';
}

function resolveEffectiveMaxCR(playerStats, maxCR) {
    if (typeof maxCR === 'number') return maxCR;
    return getClassFeatures(playerStats)?.maxWildShapeChallengeRating || 0;
}

function LoadingView({ icon, title }) {
    return (
        <div className="sp-overlay sp-overlay--evasion">
            <div className="sp-modal">
                <div className="sp-header"><i className={`fa-solid ${icon}`}></i> {title}</div>
                <div className="sp-body"><p>Loading available creatures...</p></div>
            </div>
        </div>
    );
}

function ErrorView({ icon, title, error, onCancel }) {
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

function BeastRow({ beast, isSelected, wildShapeLimitations, onSelect }) {
    const cr = parseChallengeRating(beast.challenge_rating);
    const beastSpeeds = filterBeastSpeeds(beast.speed, wildShapeLimitations);
    const imageUrl = `https://paulgilchrist.github.io/dnd-tools/images/${beast.index}.jpg`;

    return (
        <div
            className={`wild-shape-beast-item ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelect(beast)}
        >
            <div className="wild-shape-beast-avatar">
                <img
                    src={imageUrl}
                    alt={beast.name}
                    onError={(e) => { e.target.style.display = 'none'; }}
                />
            </div>
            <div className="wild-shape-beast-info">
                <div className="wild-shape-beast-name">
                    {beast.name}
                    <span className="wild-shape-beast-cr">CR {cr}</span>
                </div>
                <div className="wild-shape-beast-stats">
                    <span>{beast.size}</span>
                    <span>{formatSpeed(beastSpeeds)}</span>
                </div>
                <div className="wild-shape-beast-actions">
                    {getBeastActionsSummary(beast.actions)}
                </div>
            </div>
        </div>
    );
}

function PolymorphSelectionModal({ playerStats, maxCR, campaignName, title = 'Wild Shape', icon = 'fa-paw', actionLabel = 'Wild Shape', allowAnyCreature = false, mode = 'creature_to_creature', excludeTypes = [], onConfirm, onCancel }) {
    const [beasts, setBeasts] = React.useState([]);
    const [selectedBeast, setSelectedBeast] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [searchTerm, setSearchTerm] = React.useState('');

    const wildShapeLimitations = resolveWildShapeLimitations(playerStats);
    const effectiveMaxCR = resolveEffectiveMaxCR(playerStats, maxCR);

    React.useEffect(() => {
        async function loadBeasts() {
            try {
                const allMonsters = await loadMonsters();
                setBeasts(filterCreatureList(allMonsters, { allowAnyCreature, excludeTypes, mode, effectiveMaxCR, wildShapeLimitations }));
            } catch (err) {
                console.error('[PolymorphSelectionModal] Error loading beasts:', err);
                setError('Failed to load creature data.');
            } finally {
                setLoading(false);
            }
        }
        loadBeasts();
    }, [playerStats, effectiveMaxCR, wildShapeLimitations, campaignName, allowAnyCreature, mode, excludeTypes]);

    const filteredBeasts = React.useMemo(() => {
        if (!searchTerm.trim()) return beasts;
        const term = searchTerm.toLowerCase();
        return beasts.filter(b => b.name.toLowerCase().includes(term));
    }, [beasts, searchTerm]);

    const handleSelect = (beast) => {
        setSelectedBeast(beast);
    };

    const handleConfirm = () => {
        if (selectedBeast) {
            onConfirm(selectedBeast);
        }
    };

    React.useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onCancel() };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onCancel]);

    if (loading) {
        return <LoadingView icon={icon} title={title} />;
    }

    if (error) {
        return <ErrorView icon={icon} title={title} error={error} onCancel={onCancel} />;
    }

    const { listLabel, searchPlaceholder, noResultsMsg } = computeListCopy({ allowAnyCreature, mode, effectiveMaxCR, wildShapeLimitations });

    return (
        <div className="sp-overlay sp-overlay--evasion" onClick={(e) => {
            if (e.target.closest('.sp-modal')) return;
            onCancel();
        }}>
            <div className="sp-modal">
                <div className="sp-header"><i className={`fa-solid ${icon}`}></i> {title}</div>
                <div className="sp-body">
                    <p>{listLabel}</p>
                    {wildShapeLimitations && !allowAnyCreature && (
                        <div className="wild-shape-info">
                            <strong>Movement:</strong> {wildShapeLimitations}
                        </div>
                    )}
                    {excludeTypes.length > 0 && (
                        <div className="wild-shape-info">
                            <strong>Excluded Types:</strong> {excludeTypes.join(', ')}
                        </div>
                    )}
                    <div className="wild-shape-search">
                        <input
                            type="text"
                            placeholder={searchPlaceholder}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="wild-shape-list">
                        {filteredBeasts.length === 0 ? (
                            <p className="sp-note">{noResultsMsg}</p>
                        ) : (
                            filteredBeasts.map((beast) => (
                                <BeastRow
                                    key={beast.index}
                                    beast={beast}
                                    isSelected={selectedBeast?.index === beast.index}
                                    wildShapeLimitations={wildShapeLimitations}
                                    onSelect={handleSelect}
                                />
                            ))
                        )}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-dismiss-btn" onClick={onCancel}>Cancel</button>
                    <button
                        className="sp-roll-btn"
                        onClick={handleConfirm}
                        disabled={!selectedBeast}
                    >
                        <i className={`fa-solid ${icon}`}></i> {actionLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default PolymorphSelectionModal;
