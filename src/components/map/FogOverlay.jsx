
import { CELL_SIZE } from '../../config/mapConfig';

const FogOverlay = ({ fog, isLocalhost }) => {
    if (!isLocalhost || !fog) return null;

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
                        className="no-print fog-cell"
                    />
                );
            })}
        </>
    );
};

export default FogOverlay;
