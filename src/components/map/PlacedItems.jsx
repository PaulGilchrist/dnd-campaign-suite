
const CELL_SIZE = 40;
const RADIUS = 20;

function PlacedItems({
    placedItems,
    isLocalhost,
    fog,
    gridCenterX,
    gridCenterY,
    setSelectedItem,
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
                        <circle cx={cx} cy={cy} r={RADIUS} fill="transparent" className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
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
                            className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
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
                            className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
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
                            className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
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
        const isOpen = !!item.open;
        return (
            <g key={item.id} className="placed-item">
                {!isOpen ? (
                    <use href="#door" x={cx - 18} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1}
                        transform={item.rotation ? `rotate(${item.rotation}, ${cx}, ${cy})` : undefined} />
                ) : (
                    <>
                        {(!item.rotation || item.rotation === 0) ? (
                            <>
                                <rect x={cx - 18} y={cy - 18} width={36} height={5} fill="#8B5A2B" opacity="0.5" rx="1" />
                                <rect x={cx - 18} y={cy + 13} width={36} height={5} fill="#8B5A2B" opacity="0.5" rx="1" />
                            </>
                        ) : (
                            <>
                                <rect x={cx - 18} y={cy - 18} width={5} height={36} fill="#8B5A2B" opacity="0.5" rx="1" />
                                <rect x={cx + 13} y={cy - 18} width={5} height={36} fill="#8B5A2B" opacity="0.5" rx="1" />
                            </>
                        )}
                    </>
                )}
                {isLocalhost && (
                    <>
                        <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="transparent"
                            className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
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
                            className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
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
                            className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
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
                            className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
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
                            className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderAltar = (item) => {
        const isRotated = (item.rotation || 0) === 90;
        const cx = isRotated ? gridCenterX(item.gridX) : gridCenterX(item.gridX) + CELL_SIZE / 2;
        const cy = isRotated ? gridCenterY(item.gridY) + CELL_SIZE / 2 : gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        const altarW = isRotated ? 36 : 72;
        const altarH = isRotated ? 72 : 36;
        return (
            <g key={item.id} className="placed-item">
                <use href="#altar" x={cx - 36} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1}
                    transform={isRotated ? `rotate(90, ${cx}, ${cy})` : undefined} />
                {isLocalhost && (
                    <>
                        <rect x={cx - altarW / 2} y={cy - altarH / 2} width={altarW} height={altarH} fill="transparent"
                            className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <rect x={cx - altarW / 2} y={cy - altarH / 2} width={altarW} height={altarH} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderBookshelf = (item) => {
        const rotation = item.rotation || 0;
        const isVertical = rotation % 180 === 90;
        const cx = isVertical ? gridCenterX(item.gridX) : gridCenterX(item.gridX) + CELL_SIZE / 2;
        const cy = isVertical ? gridCenterY(item.gridY) + CELL_SIZE / 2 : gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        const w = isVertical ? 36 : 72;
        const h = isVertical ? 72 : 36;
        return (
            <g key={item.id} className="placed-item">
                <use href="#bookshelf" x={cx - 36} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1}
                    transform={rotation ? `rotate(${rotation}, ${cx}, ${cy})` : undefined} />
                {isLocalhost && (
                    <>
                        <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill="transparent"
                            className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderChair = (item) => {
        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        return (
            <g key={item.id} className="placed-item">
                <use href="#chair" x={cx - 18} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1}
                    transform={item.rotation ? `rotate(${item.rotation}, ${cx}, ${cy})` : undefined} />
                {isLocalhost && (
                    <>
                        <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="transparent"
                            className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderChest = (item) => {
        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        return (
            <g key={item.id} className="placed-item">
                <use href="#chest" x={cx - 18} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1} />
                {isLocalhost && (
                    <>
                        <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="transparent"
                            className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderCrate = (item) => {
        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        return (
            <g key={item.id} className="placed-item">
                <use href="#crate" x={cx - 18} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1} />
                {isLocalhost && (
                    <>
                        <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="transparent"
                            className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderFountain = (item) => {
        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        return (
            <g key={item.id} className="placed-item">
                <use href="#fountain" x={cx - 18} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1} />
                {isLocalhost && (
                    <>
                        <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="transparent"
                            className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderSkeleton = (item) => {
        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        return (
            <g key={item.id} className="placed-item">
                <use href="#skeleton" x={cx - 18} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1} />
                {isLocalhost && (
                    <>
                        <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="transparent"
                            className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderStatue = (item) => {
        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        return (
            <g key={item.id} className="placed-item">
                <use href="#statue" x={cx - 18} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1} />
                {isLocalhost && (
                    <>
                        <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="transparent"
                            className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderTorch = (item) => {
        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        return (
            <g key={item.id} className="placed-item">
                <use href="#torch" x={cx - 18} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1}
                    transform={item.rotation ? `rotate(${item.rotation}, ${cx}, ${cy})` : undefined} />
                {isLocalhost && (
                    <>
                        <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="transparent"
                            className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderWeb = (item) => {
        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        return (
            <g key={item.id} className="placed-item">
                <use href="#web" x={cx - 18} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1} />
                {isLocalhost && (
                    <>
                        <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="transparent"
                            className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
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
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        const npcOpacity = isLocalhost ? (item.visible ? 1 : 0.5) : 1;

        return (
            <g key={item.id} className="npc-group">
                <defs>
                    <clipPath id={`npc-clip-${item.id}`}>
                        <circle cx={cx} cy={cy} r={20} />
                    </clipPath>
                </defs>
                <circle cx={cx} cy={cy} r={20} className="npc-circle" style={{ opacity: npcOpacity }} />
                {(npcImages[item.name] || item.imageUrl) ? (
                    <image
                        xlinkHref={npcImages[item.name] || item.imageUrl}
                        x={cx - 18}
                        y={cy - 18}
                        width={36}
                        height={36}
                        preserveAspectRatio="xMidYMid slice"
                        clipPath={`url(#npc-clip-${item.id})`}
                        className="creature-image"
                        style={{ opacity: npcOpacity }}
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
                        style={{ opacity: npcOpacity }}
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
                    style={{ opacity: npcOpacity }}
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
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
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

    const renderArrowSlitWall = (item) => {
        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        return (
            <g key={item.id} className="placed-item">
                <use href="#arrowSlitWall" x={cx - 18} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1}
                    transform={item.rotation ? `rotate(${item.rotation}, ${cx}, ${cy})` : undefined} />
                {isLocalhost && (
                    <>
                        <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="transparent"
                            className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderTree = (item) => {
        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        return (
            <g key={item.id} className="placed-item">
                <use href="#tree" x={cx - 18} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1} />
                {isLocalhost && (
                    <>
                        <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="transparent"
                            className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderBoulder = (item) => {
        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        return (
            <g key={item.id} className="placed-item">
                <use href="#boulder" x={cx - 18} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1} />
                {isLocalhost && (
                    <>
                        <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="transparent"
                            className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderBush = (item) => {
        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);
        if (!isLocalhost && (!item.visible || fog?.has(`${item.gridX},${item.gridY}`))) return null;
        return (
            <g key={item.id} className="placed-item">
                <use href="#bush" x={cx - 18} y={cy - 18} opacity={isLocalhost ? (item.visible ? 1 : 0.5) : 1} />
                {isLocalhost && (
                    <>
                        <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="transparent"
                            className="item-hit-area"
                            onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY }); }}
                            style={{ cursor: 'grab' }} />
                        {itemDragging?.itemId === item.id && (
                            <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderItems = (type, renderFn) => placedItems.filter(i => i.type === type).map(renderFn).filter(Boolean)

    return (
        <>
            {renderItems('altar', renderAltar)}
            {renderItems('arrowSlitWall', renderArrowSlitWall)}
            {renderItems('barrel', renderBarrel)}
            {renderItems('bed', renderBed)}
            {renderItems('bookshelf', renderBookshelf)}
            {renderItems('boulder', renderBoulder)}
            {renderItems('bush', renderBush)}
            {renderItems('chair', renderChair)}
            {renderItems('chest', renderChest)}
            {renderItems('crate', renderCrate)}
            {renderItems('door', renderDoor)}
            {renderItems('firepit', renderFirepit)}
            {renderItems('fountain', renderFountain)}
            {renderItems('npc', renderNpc)}
            {renderItems('pillar', renderPillar)}
            {renderItems('secretDoor', renderSecretDoor)}
            {renderItems('skeleton', renderSkeleton)}
            {renderItems('stairs', renderStairs)}
            {renderItems('statue', renderStatue)}
            {renderItems('table', renderTable)}
            {renderItems('torch', renderTorch)}
            {renderItems('trap', renderTrap)}
            {renderItems('tree', renderTree)}
            {renderItems('web', renderWeb)}
        </>
    );
}

export default PlacedItems;
