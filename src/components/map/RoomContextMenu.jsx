import { ROOM_TYPES, ROOM_TYPE_COLORS, CELL_SIZE } from '../../config/mapConfig';

function RoomContextMenu({ selectedRoom, isLocalhost, gridSize, gridCenterX, gridCenterY, setMapData, setSelectedRoom }) {
    if (!selectedRoom || !isLocalhost) return null;

    const r = selectedRoom.rect;
    const menuX = Math.min(gridCenterX(r.x + r.w) + 10, gridSize * CELL_SIZE - 140);
    const menuY = gridCenterY(r.y) - CELL_SIZE / 2;

    return (
        <g className="item-context-menu" onClick={(e) => e.stopPropagation()}>
            <g>
                <rect x={menuX} y={menuY} width="130" height={72 + ROOM_TYPES.length * 20} rx="4" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
                <text x={menuX + 8} y={menuY + 16} fill="#e0e0e0" fontSize="11" fontWeight="bold">Room</text>
                <text
                    x={menuX + 8}
                    y={menuY + 34}
                    fill="#ccc"
                    fontSize="11"
                    className="menu-option"
                    onClick={() => {
                        const label = prompt('Room label:', selectedRoom.label || '');
                        if (label !== null) {
                            setMapData(prev => ({
                                ...prev,
                                rooms: (prev.rooms || []).map(rr =>
                                    rr.id === selectedRoom.id ? { ...rr, label } : rr
                                ),
                            }));
                        }
                        setSelectedRoom(null);
                    }}
                >
                    Set Label...
                </text>
                {ROOM_TYPES.map((type, i) => (
                    <g key={type} style={{ cursor: 'pointer' }} onClick={() => {
                        setMapData(prev => ({
                            ...prev,
                            rooms: (prev.rooms || []).map(rr =>
                                rr.id === selectedRoom.id ? { ...rr, type } : rr
                            ),
                        }));
                        setSelectedRoom(null);
                    }}>
                        <rect x={menuX + 8} y={menuY + 52 + i * 20 - 6} width={8} height={8} rx={2} fill={ROOM_TYPE_COLORS[type] || '#888'} />
                        <text
                            x={menuX + 20}
                            y={menuY + 52 + i * 20}
                            fill={selectedRoom.type === type ? '#fff' : '#ccc'}
                            fontSize="11"
                            fontWeight={selectedRoom.type === type ? 'bold' : 'normal'}
                            className="menu-option"
                        >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                        </text>
                    </g>
                ))}
                <text
                    x={menuX + 8}
                    y={menuY + 52 + ROOM_TYPES.length * 20}
                    fill="#e74c3c"
                    fontSize="11"
                    className="menu-option"
                    onClick={() => {
                        setMapData(prev => ({
                            ...prev,
                            rooms: (prev.rooms || []).filter(rr => rr.id !== selectedRoom.id),
                        }));
                        setSelectedRoom(null);
                    }}
                >
                    Delete Room
                </text>
                <text x={menuX + 118} y={menuY + 14} fill="#999" fontSize="10" className="menu-close" onClick={() => setSelectedRoom(null)}>✕</text>
            </g>
        </g>
    );
}

export default RoomContextMenu;
