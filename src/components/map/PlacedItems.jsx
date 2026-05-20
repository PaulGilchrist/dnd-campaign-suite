import React from 'react';

const CELL_SIZE = 40;
const RADIUS = 20;

function PlacedItems({
    placedItems,
    isLocalhost,
    fog,
    gridCenterX,
    gridCenterY,
    setSelectedBarrel,
    npcImages,
    itemDragging,
    handleItemPointerDown,
}) {
    const renderBarrel = (item) => {
        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        return (
            <g key={item.id} className="placed-item">
                <use href="#barrel" x={cx - 18} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1} />
                {isLocalhost && (
                    <>
                        <circle cx={cx} cy={cy} r={RADIUS} fill="transparent" className="barrel-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedBarrel({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <circle cx={cx} cy={cy} r={RADIUS + 4} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderTable = (item) => {
        const isRotated = (item.rotation || 0) === 90;
        const cx = isRotated ? gridCenterX(item.gridX) : gridCenterX(item.gridX) + CELL_SIZE / 2;
        const cy = isRotated ? gridCenterY(item.gridY) + CELL_SIZE / 2 : gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        const tableW = isRotated ? 36 : 72;
        const tableH = isRotated ? 72 : 36;
        return (
            <g key={item.id} className="placed-item">
                <use href="#table" x={cx - 36} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1}
                    transform={isRotated ? `rotate(90, ${cx}, ${cy})` : undefined} />
                {isLocalhost && (
                    <>
                        <rect x={cx - tableW / 2} y={cy - tableH / 2} width={tableW} height={tableH} fill="transparent"
                            className="barrel-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedBarrel({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <rect x={cx - tableW / 2} y={cy - tableH / 2} width={tableW} height={tableH} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderBed = (item) => {
        const isVertical = (item.rotation || 0) % 180 === 90;
        const cx = isVertical ? gridCenterX(item.gridX) : gridCenterX(item.gridX) + CELL_SIZE / 2;
        const cy = isVertical ? gridCenterY(item.gridY) + CELL_SIZE / 2 : gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        const bedW = isVertical ? 36 : 72;
        const bedH = isVertical ? 72 : 36;
        return (
            <g key={item.id} className="placed-item">
                <use href="#bed" x={cx - 36} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1}
                    transform={item.rotation ? `rotate(${item.rotation}, ${cx}, ${cy})` : undefined} />
                {isLocalhost && (
                    <>
                        <rect x={cx - bedW / 2} y={cy - bedH / 2} width={bedW} height={bedH} fill="transparent"
                            className="barrel-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedBarrel({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <rect x={cx - bedW / 2} y={cy - bedH / 2} width={bedW} height={bedH} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderFirepit = (item) => {
        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        return (
            <g key={item.id} className="placed-item">
                <use href="#firepit" x={cx - 18} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1} />
                {isLocalhost && (
                    <>
                        <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="transparent"
                            className="barrel-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedBarrel({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <circle cx={cx} cy={cy} r={18} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderDoor = (item) => {
        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        return (
            <g key={item.id} className="placed-item">
                <use href="#door" x={cx - 18} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1}
                    transform={item.rotation ? `rotate(${item.rotation}, ${cx}, ${cy})` : undefined} />
                {isLocalhost && (
                    <>
                        <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="transparent"
                            className="barrel-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedBarrel({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderSecretDoor = (item) => {
        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        return (
            <g key={item.id} className="placed-item">
                <use href="#secretDoor" x={cx - 18} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1}
                    transform={item.rotation ? `rotate(${item.rotation}, ${cx}, ${cy})` : undefined} />
                {isLocalhost && (
                    <>
                        <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="transparent"
                            className="barrel-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedBarrel({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderTrap = (item) => {
        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        return (
            <g key={item.id} className="placed-item">
                <use href="#trap" x={cx - 18} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1} />
                {isLocalhost && (
                    <>
                        <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="transparent"
                            className="barrel-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedBarrel({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderPillar = (item) => {
        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        return (
            <g key={item.id} className="placed-item">
                <use href="#pillar" x={cx - 18} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1} />
                {isLocalhost && (
                    <>
                        <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="transparent"
                            className="barrel-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedBarrel({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderStairs = (item) => {
        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        return (
            <g key={item.id} className="placed-item">
                <use href="#stairs" x={cx - 18} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1}
                    transform={item.rotation ? `rotate(${item.rotation}, ${cx}, ${cy})` : undefined} />
                {isLocalhost && (
                    <>
                        <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="transparent"
                            className="barrel-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedBarrel({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderNpc = (item) => {
        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);
        const isFogged = !isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`));

        return (
            <g key={item.id} className="npc-group">
                <defs>
                    <clipPath id={`npc-clip-${item.id}`}>
                        <circle cx={cx} cy={cy} r={20} />
                    </clipPath>
                </defs>
                <circle cx={cx} cy={cy} r={20} className="npc-circle" />
                {(npcImages[item.id] || item.imageUrl) ? (
                    <image
                        xlinkHref={npcImages[item.id] || item.imageUrl}
                        x={cx - 18}
                        y={cy - 18}
                        width={36}
                        height={36}
                        preserveAspectRatio="xMidYMid slice"
                        clipPath={`url(#npc-clip-${item.id})`}
                        className="creature-image"
                        style={{ opacity: isFogged ? 0.3 : 1 }}
                    />
                ) : (
                    <text
                        x={cx}
                        y={cy}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#fff"
                        fontSize="16"
                        fontWeight="bold"
                        className="npc-initial"
                        style={{ opacity: isFogged ? 0.3 : 1 }}
                    >
                        {item.name.charAt(0).toUpperCase()}
                    </text>
                )}
                <text
                    x={cx}
                    y={cy + 16}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="18"
                    fontWeight="bold"
                    className="npc-name"
                    style={{ opacity: isFogged ? 0.3 : 1 }}
                >
                    {item.name}
                </text>
                {isLocalhost && (
                    <>
                        <rect
                            x={cx - RADIUS}
                            y={cy - RADIUS}
                            width={RADIUS * 2}
                            height={RADIUS * 2}
                            fill="transparent"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedBarrel({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }}
                        />
                        {itemDragging?.itemId === item.id && (
                            <circle cx={cx} cy={cy} r={RADIUS + 4} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    return (
        <>
            {placedItems.filter(item => item.type === 'barrel').map(renderBarrel)}
            {placedItems.filter(item => item.type === 'table').map(renderTable)}
            {placedItems.filter(item => item.type === 'bed').map(renderBed)}
            {placedItems.filter(item => item.type === 'firepit').map(renderFirepit)}
            {placedItems.filter(item => item.type === 'door').map(renderDoor)}
            {placedItems.filter(item => item.type === 'secretDoor').map(renderSecretDoor)}
            {placedItems.filter(item => item.type === 'trap').map(renderTrap)}
            {placedItems.filter(item => item.type === 'pillar').map(renderPillar)}
            {placedItems.filter(item => item.type === 'stairs').map(renderStairs)}
            {placedItems.filter(item => item.type === 'npc').map(renderNpc)}
        </>
    );
}

export default PlacedItems;
