import { useState } from 'react';
import { generateHexTerrain } from '../../services/hexTerrainGenerator.js';
import * as mapsService from '../../services/mapsService.js';
import './GenerateTerrainModal.css';

function GenerateTerrainModal({ campaignName, initialMapName, onClose, onMapCreated }) {
    const [mapName, setMapName] = useState(initialMapName || '');
    const [gridSize, setGridSize] = useState(30);
    const [seed, setSeed] = useState('');
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState(null);

    const handleGenerate = async () => {
        const name = mapName.trim();
        if (!name) {
            setError('Map name cannot be empty');
            return;
        }

        const safeGridSize = Math.max(5, Math.min(100, gridSize));
        setGenerating(true);

        try {
            const seedValue = seed.trim() ? parseInt(seed.trim(), 10) || undefined : undefined;
            const result = generateHexTerrain({
                gridSize: safeGridSize,
                seed: seedValue,
            });

            await mapsService.createMap(campaignName, name, {
                type: 'outdoor',
                gridSize: safeGridSize,
                terrain: result.terrain,
                pois: [],
            });

            onMapCreated();
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to generate terrain');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="maps-manager-modal-overlay" onClick={onClose}>
            <div className="maps-manager-modal terrain-gen-modal" onClick={e => e.stopPropagation()}>
                <h3>Generate Terrain Map</h3>

                {error && <div className="maps-manager-error">{error}</div>}

                <div className="dungeon-gen-form">
                    <label className="dungeon-gen-field">
                        <span>Map Name</span>
                        <input
                            type="text"
                            value={mapName}
                            onChange={e => setMapName(e.target.value)}
                            placeholder="e.g. The Wild Frontier"
                            autoFocus
                        />
                    </label>

                    <label className="dungeon-gen-field">
                        <span>Grid Size</span>
                        <input
                            type="number"
                            min={5}
                            max={100}
                            value={gridSize}
                            onChange={e => setGridSize(Number(e.target.value))}
                        />
                        <span className="dungeon-gen-hint">
                            {gridSize} hexes &times; {gridSize} hexes ({gridSize * gridSize} hexes)
                        </span>
                    </label>

                    <label className="dungeon-gen-field">
                        <span>Seed (optional)</span>
                        <input
                            type="text"
                            value={seed}
                            onChange={e => setSeed(e.target.value)}
                            placeholder="Random"
                        />
                    </label>
                </div>
                <div className="dungeon-gen-note">
                    Generates a terrain map using noise-based elevation and moisture to create realistic biomes. Use the seed to get different results.
                </div>
                <div className="maps-manager-modal-actions">
                    <button onClick={onClose} disabled={generating}>
                        Cancel
                    </button>
                    <button
                        className="dungeon-gen-generate-btn"
                        onClick={handleGenerate}
                        disabled={!mapName.trim() || generating}
                    >
                        {generating ? 'Generating...' : 'Generate'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default GenerateTerrainModal;
