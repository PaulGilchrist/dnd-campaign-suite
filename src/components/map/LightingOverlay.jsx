import { CELL_SIZE } from '../../config/mapConfig';

/**
 * Dynamic lighting veil (deferred plan C) — sibling of FogOverlay, same
 * rect-per-"x,y"-cell rendering. Mounted immediately AFTER FogOverlay in the
 * svg paint order: content < fog < LIGHT < selection/context/spell overlays,
 * so spell zones and hazards keep drawing above the dark (zone visibility
 * law stays with fog, not light).
 *
 * TIERS (light ≠ fog reads by COLOR: warm indigo-blacks vs fog's neutral
 * grey): a dim-ring cell (outer torch halo) gets the lighter fill; every
 * other unlit cell gets the dark fill. The GM sees through both softly;
 * player tabs get heavy veils — explored-but-unlit vs unexplored-and-unlit
 * stay visually distinct because the opaque fog rect underneath still
 * decides how much of the board is hidden at all.
 *
 * OFF STATE: `lighting === null` renders NOTHING — zero DOM, byte-identical
 * to the pre-feature map (unit-pinned).
 */
const LightingOverlay = ({ lighting, gridSize, isLocalhost }) => {
    if (!lighting) return null;

    const { bright, dim } = lighting;
    const cells = [];
    for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
            const key = `${x},${y}`;
            if (bright.has(key)) continue;
            cells.push({ key, x, y, tier: dim.has(key) ? 'ring' : 'dark' });
        }
    }

    const cls = (tier) => `no-print ${isLocalhost ? `light-cell-${tier}` : `light-cell-player-${tier}`}`;
    return (
        <>
            {cells.map(({ key, x, y, tier }) => (
                <rect
                    key={`light-${key}`}
                    x={x * CELL_SIZE}
                    y={y * CELL_SIZE}
                    width={CELL_SIZE}
                    height={CELL_SIZE}
                    className={cls(tier)}
                    data-cell={key}
                    data-light-tier={tier}
                />
            ))}
        </>
    );
};

export default LightingOverlay;
