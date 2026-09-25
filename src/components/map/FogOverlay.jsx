
import { CELL_SIZE } from '../../config/mapConfig';

// The GM sees through a translucent veil (fog-cell); the player sees an opaque
// grey covering (fog-cell-player) so fogged areas read as "covered/unknown"
// while still hiding whatever is beneath (walls, items, players).
const FogOverlay = ({ fog, isLocalhost }) => {
    if (!fog) return null;

    const cellClass = isLocalhost ? 'fog-cell' : 'fog-cell-player';

    return (
        <>
            {Array.from(fog).map((key) => {
                const [gx, gy] = key.split(',').map(Number);
                return (
                    <rect
                        key={`fog-${key}`}
                        x={gx * CELL_SIZE}
                        y={gy * CELL_SIZE}
                        width={CELL_SIZE}
                        height={CELL_SIZE}
                        className={`no-print ${cellClass}`}
                    />
                );
            })}
        </>
    );
};

export default FogOverlay;
