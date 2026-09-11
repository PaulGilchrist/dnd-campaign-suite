import { CELL_SIZE, TOOL_NONE, TOOL_SELECT } from '../../config/mapConfig';
import { getSelectionBounds } from './selectionBounds.js';

const WIDE_ITEM_TYPES = ['table', 'bed', 'altar', 'bookshelf'];

export function SelectionPreviewRect({ visible = true, rect, className }) {
    if (!visible || !rect) return null;
    const { minX, maxX, minY, maxY } = rect;
    return (
        <rect
            x={minX * CELL_SIZE}
            y={minY * CELL_SIZE}
            width={(maxX - minX + 1) * CELL_SIZE}
            height={(maxY - minY + 1) * CELL_SIZE}
            className={className}
        />
    );
}

export function RoomShape({ room, tool, selectedRoom }) {
    const r = room.rect;
    const isSelected = selectedRoom && selectedRoom.id === room.id;
    const typeClass = 'room-type-' + (room.type || 'common');
    return (
        <g>
            <rect
                x={r.x * CELL_SIZE}
                y={r.y * CELL_SIZE}
                width={r.w * CELL_SIZE}
                height={r.h * CELL_SIZE}
                className={`room-highlight ${typeClass} ${isSelected ? 'room-selected' : ''}`}
            />
            {(tool === TOOL_NONE || tool === TOOL_SELECT) && (
                <rect
                    x={r.x * CELL_SIZE}
                    y={r.y * CELL_SIZE}
                    width={r.w * CELL_SIZE}
                    height={r.h * CELL_SIZE}
                    fill="transparent"
                    className="room-hit-area"
                />
            )}
            <text
                x={(r.x + r.w / 2) * CELL_SIZE}
                y={(r.y + r.h / 2) * CELL_SIZE}
                className="room-label"
                textAnchor="middle"
                dominantBaseline="central"
            >
                {room.label || room.type || 'common'}
            </text>
        </g>
    );
}

export function SelectionOutline({ selectionActive, moveActive, selectedWalls, selectedItems, placedItems }) {
    if (selectionActive || moveActive) return null;
    if (selectedWalls.size === 0 && selectedItems.size === 0) return null;
    const bounds = getSelectionBounds(selectedWalls, selectedItems, placedItems);
    if (!bounds) return null;
    const { mnX, mxX, mnY, mxY } = bounds;
    return (
        <rect
            x={mnX * CELL_SIZE}
            y={mnY * CELL_SIZE}
            width={(mxX - mnX + 1) * CELL_SIZE}
            height={(mxY - mnY + 1) * CELL_SIZE}
            className="selection-outline"
        />
    );
}

export function MovePreview({ moveOffset, selectedWalls, selectedItems, placedItems }) {
    if (!moveOffset || (moveOffset.dx === 0 && moveOffset.dy === 0)) return null;
    if (selectedWalls.size === 0 && selectedItems.size === 0) return null;
    const bounds = getSelectionBounds(selectedWalls, selectedItems, placedItems);
    if (!bounds) return null;
    const { mnX, mxX, mnY, mxY } = bounds;
    return (
        <rect
            x={(mnX + moveOffset.dx) * CELL_SIZE}
            y={(mnY + moveOffset.dy) * CELL_SIZE}
            width={(mxX - mnX + 1) * CELL_SIZE}
            height={(mxY - mnY + 1) * CELL_SIZE}
            className="selection-preview"
        />
    );
}

export function SelectedWalls({ selectedWalls }) {
    if (selectedWalls.size === 0) return null;
    return Array.from(selectedWalls).map(key => {
        const [gx, gy] = key.split(',').map(Number);
        return (
            <rect
                key={`sel-wall-${key}`}
                x={gx * CELL_SIZE}
                y={gy * CELL_SIZE}
                width={CELL_SIZE}
                height={CELL_SIZE}
                className="selection-wall"
            />
        );
    });
}

export function SelectedItemHighlights({ selectedItems, placedItems }) {
    if (selectedItems.size === 0) return null;
    return placedItems.filter(item => selectedItems.has(item.id)).map(item => {
        const wide = WIDE_ITEM_TYPES.includes(item.type);
        const sideways = item.rotation === 90 || item.rotation === 270;
        const w = wide && !sideways ? CELL_SIZE * 2 : CELL_SIZE;
        const h = wide && sideways ? CELL_SIZE * 2 : CELL_SIZE;
        return (
            <rect
                key={`sel-item-${item.id}`}
                x={item.gridX * CELL_SIZE}
                y={item.gridY * CELL_SIZE}
                width={w}
                height={h}
                className="selection-item-highlight"
            />
        );
    });
}
