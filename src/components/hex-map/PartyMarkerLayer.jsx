import { useRef } from 'react';
import { hexToPixel, pixelToHexSnapped, hexToSVGPath } from '../../services/hexMapUtils.js';

function PartyMarkerLayer({ position, HEX_SIZE, hexCols, hexRows, onPositionChange, svgRef, onEncounter, contextMenuOpen, onContextMenu, travelMode, onAdvance, onCancelTravel }) {
    const draggingRef = useRef(false);

    if (!position) return null;

    const center = hexToPixel(position.q, position.r, HEX_SIZE);
    const cx = center.x;
    const cy = center.y;
    const hexPath = hexToSVGPath(cx, cy, HEX_SIZE);

    const getHexFromEvent = (e) => {
        const svg = svgRef?.current;
        if (!svg) return null;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
        const hex = pixelToHexSnapped(svgP.x, svgP.y, HEX_SIZE);
        if (hex.q < 0 || hex.q >= hexCols || hex.r < 0 || hex.r >= hexRows) return null;
        return hex;
    };

    const handlePointerDown = (e) => {
        if (e.button === 2 || disabled) return;
        e.preventDefault();
        e.stopPropagation();
        draggingRef.current = true;

        const handlePointerMove = (ev) => {
            if (!draggingRef.current) return;
            const hex = getHexFromEvent(ev);
            if (hex) {
                onPositionChange({ q: hex.q, r: hex.r });
            }
        };

        const handlePointerUp = () => {
            draggingRef.current = false;
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
        };

        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onContextMenu) onContextMenu(position.q, position.r);
    };

    const handleStartEncounter = () => {
        if (onEncounter) onEncounter(position.q, position.r);
    };

    const handleAdvance = () => {
        if (onAdvance) onAdvance();
    };

    const handleCancelTravel = () => {
        if (onCancelTravel) onCancelTravel();
    };

    const disabled = travelMode && travelMode !== 'inactive';

    return (
        <g className="party-marker-layer">
            <path
                d={hexPath}
                fill="#FFD700"
                fillOpacity={0.25}
                stroke="#FFD700"
                strokeWidth={3}
                strokeDasharray="6 3"
                style={{ cursor: 'grab' }}
                onPointerDown={handlePointerDown}
                onContextMenu={handleContextMenu}
            />
            <text
                x={cx}
                y={cy + 4}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#FFD700"
                fontSize={HEX_SIZE * 0.8}
                fontWeight="bold"
                pointerEvents="none"
                style={{ textShadow: '0 0 6px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.9)' }}
            >
                P
            </text>
            {contextMenuOpen && travelMode === 'inactive' && (() => {
                const menuW = 140;
                const menuH = 30;
                const menuX = cx + 15;
                const menuY = cy - 15;
                return (
                    <g className="party-context-menu">
                        <rect x={menuX} y={menuY} width={menuW} height={menuH} rx="4" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
                        <rect x={menuX} y={menuY} width={menuW} height={menuH} rx="4" fill="transparent" className="party-menu-hit" onClick={handleStartEncounter} />
                        <text
                            x={menuX + 8}
                            y={menuY + 20}
                            fill="#FFD700"
                            fontSize="11"
                            className="party-menu-text"
                            pointerEvents="none"
                        >
                            Start Encounter
                        </text>
                    </g>
                );
            })()}

            {contextMenuOpen && travelMode !== 'inactive' && (() => {
                const menuW = 160;
                const menuH = 70;
                const menuX = cx + 15;
                const menuY = cy - 35;
                return (
                    <g className="party-context-menu">
                        <rect x={menuX} y={menuY} width={menuW} height={menuH} rx="4" fill="#2a2a2a" stroke="#FFD700" strokeWidth="1" />
                        <rect x={menuX} y={menuY} width={menuW} height={menuH / 2 - 2} rx="4" fill="transparent" className="party-menu-hit" onClick={handleAdvance} />
                        <text
                            x={menuX + 8}
                            y={menuY + 20}
                            fill="#FFD700"
                            fontSize="11"
                            className="party-menu-text"
                            pointerEvents="none"
                        >
                            Advance One Hex
                        </text>
                        <rect x={menuX} y={menuY + menuH / 2 + 2} width={menuW} height={menuH / 2 - 2} rx="4" fill="transparent" className="party-menu-hit" onClick={handleCancelTravel} />
                        <text
                            x={menuX + 8}
                            y={menuY + menuH / 2 + 22}
                            fill="#e88"
                            fontSize="11"
                            className="party-menu-text"
                            pointerEvents="none"
                        >
                            Cancel Travel
                        </text>
                    </g>
                );
            })()}
        </g>
    );
}

export default PartyMarkerLayer;
