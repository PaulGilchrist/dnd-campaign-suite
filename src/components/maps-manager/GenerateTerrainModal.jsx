import { useState } from 'react';
import { generateHexTerrain } from '../../services/maps/hexTerrainGenerator.js';
import { parseGridInput } from '../../services/maps/gridInput.js';
import { parseSeedInput, SEED_INPUT_PLACEHOLDER } from '../../services/maps/seedInput.js';
import * as mapsService from '../../services/maps/mapsService.js';
import './GenerateTerrainModal.css';
import './gen-modal-shared.css';

function GenerateTerrainModal({ campaignName, initialMapName, onClose, onMapCreated }) {
    const [mapName, setMapName] = useState(initialMapName || '');
    const [gridSize, setGridSize] = useState(30);
    const [seed, setSeed] = useState('');
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState(null);

    // Editing any field clears a stale error banner so it never lingers next
    // to now-valid inputs (TE backlog 2026-11-12).
    const editName = (event) => { setError(null); setMapName(event.target.value); };
    const editGrid = (event) => { setError(null); setGridSize(Number(event.target.value)); };
    const editSeed = (event) => { setError(null); setSeed(event.target.value); };

    const handleGenerate = async () => {
        const name = mapName.trim();
        if (!name) {
            setError('Map name cannot be empty');
            return;
        }

        // Block an out-of-range grid size with a persistent inline error
        // BEFORE generating — the old silent clamp (min 30, max 100) landed a
        // bigger map than the hint promised and closed the modal so no notice
        // was ever seen, diverging from the dungeon twin's block law
        // (TE backlog 2026-11-12). Empty input reads as 0, so blanks and
        // non-integers are honestly refused here too.
        const gridInput = parseGridInput(gridSize, 30, 100);
        if (gridInput.error) {
            setError(gridInput.error);
            return;
        }
        const typedGridSize = gridInput.gridSize;

        // Block a non-numeric seed with an inline error instead of the old
        // silent random fallback (SD 2026-11-12). Seed 0 is a valid seed.
        const seedInput = parseSeedInput(seed);
        if (seedInput.error) {
            setError(seedInput.error);
            return;
        }

        setGenerating(true);

        try {
            const result = generateHexTerrain({
                gridSize: typedGridSize,
                seed: seedInput.seed ?? undefined,
            });

            await mapsService.createMap(campaignName, name, {
                type: 'outdoor',
                gridSize: typedGridSize,
                terrain: result.terrain,
                pois: [],
                // The generator's real effective seed (typed or random) so the
                // map is reproducible from the document on disk.
                seed: result.seed,
                // Full effective options (UF backlog 2026-11-12): the terrain
                // generator consumes exactly gridSize + seed (the blank-seed
                // field resolves to the generator's own random draw, reported
                // back as result.seed); rivers/features are derived, not knobs.
                generationOpts: {
                    mode: 'terrain',
                    gridSize: typedGridSize,
                    seed: result.seed,
                },
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
        <div className="maps-manager-modal-overlay">
            <div className="maps-manager-modal terrain-gen-modal">
                <h3>Generate Terrain Map</h3>

                {error && <div className="maps-manager-error">{error}</div>}

                <div className="gen-modal-form">
                    <label className="gen-modal-field">
                        <span>Map Name</span>
                        <input
                            type="text"
                            value={mapName}
                            onChange={editName}
                            placeholder="e.g. The Wild Frontier"
                            autoFocus
                        />
                    </label>

                    <label className="gen-modal-field">
                        <span>Grid Size</span>
                        <input
                            type="number"
                            min={30}
                            max={100}
                            value={gridSize}
                            onChange={editGrid}
                        />
                        <span className="gen-modal-hint">
                            {gridSize * 2} hexes &times; {gridSize} hexes ({gridSize * gridSize * 2} hexes)
                        </span>
                    </label>

                    <label className="gen-modal-field">
                        <span>Seed (optional)</span>
                        <input
                            type="text"
                            value={seed}
                            onChange={editSeed}
                            placeholder={SEED_INPUT_PLACEHOLDER}
                        />
                    </label>
                </div>
                <div className="gen-modal-note">
                    Generates a terrain map with fractal noise for realistic elevation, lakes, rivers, beaches, and coastline. Use the seed to get different results.
                </div>
                <div className="maps-manager-modal-actions">
                    <button onClick={onClose} disabled={generating}>
                        Cancel
                    </button>
                    <button
                        className="gen-modal-generate-btn"
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
