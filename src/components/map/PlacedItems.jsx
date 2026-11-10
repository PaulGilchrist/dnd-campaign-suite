
import { CELL_SIZE, HIDDEN_MARKER_OPACITY } from '../../config/mapConfig';
import { itemSpriteHref } from '../../services/maps/itemSprites';
// One label, one source of truth (ItemDetailsDock.jsx uses the same fn):
// renamed/AI-Dressed items title as their plain `name`; unnamed props as
// `type (x,y)` so two same-type markers are distinguishable by a pure DOM
// `[title]` probe — no hover/click discovery (backlog 2026-11-01 AW).
// Parity note: the outdoor prop lane (tree/boulder/bush on parentHex grids)
// had the same gap, so the title rides every marker in both lanes.
import { placedItemLabel } from './hooks/usePlacedItems.js';
import { tokenStackTransform, isStackedToken } from '../../services/maps/tokenStackOffsets.js';
const RADIUS = 20;
const SPRITE = 36;      // single-cell sprite edge (SVG units)
const WIDE_SPRITE = 72; // two-cell sprite long edge at rotation 0

// Sprite box keeps the art's aspect (72×36 wide, 36×36 cell) and spins about
// the footprint centre; the centre itself follows the CURRENT orientation so
// a rotated two-cell prop stays on its cells (fixes the legacy 90° drift).
function propGeometry(item, opts, gridCenterX, gridCenterY) {
    const rotation = opts.rotatable ? (item.rotation || 0) : 0;
    const vertical = rotation % 180 === 90;
    const cx = gridCenterX(item.gridX) + (opts.wide ? (vertical ? 0 : CELL_SIZE / 2) : 0);
    const cy = gridCenterY(item.gridY) + (opts.wide ? (vertical ? CELL_SIZE / 2 : 0) : 0);
    const bw = opts.wide ? WIDE_SPRITE : SPRITE;
    const bh = SPRITE;
    return {
        cx, cy, bw, bh,
        boxW: vertical ? bh : bw,
        boxH: vertical ? bw : bh,
        transform: rotation ? `rotate(${rotation}, ${cx}, ${cy})` : undefined,
    };
}

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
    tokenOffsets,
}) {
    const isVisible = (item) => {
        // A secret door is never shown as an icon to players: hidden it is a
        // wall (rendered by GridAndWalls), discovered it is an empty cell. The
        // GM always sees the actual secret-door icon.
        if (item.type === 'secretDoor') return isLocalhost;
        return isLocalhost || (item.visible && !fog?.has(`${item.gridX},${item.gridY}`));
    };

    const itemOpacity = (item) => (isLocalhost ? (item.visible ? 1 : HIDDEN_MARKER_OPACITY) : 1);

    const isDragging = (item) => itemDragging?.itemId === item.id;

    const onDown = (item) => (e) => handleItemPointerDown(e, item.id);

    const onContext = (item) => (e) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedItem({ id: item.id, gridX: item.gridX, gridY: item.gridY });
    };

    const rectHitArea = (item, x, y, w, h) => (
        <rect x={x} y={y} width={w} height={h} fill="transparent"
            className="item-hit-area placed-hit-area"
            onPointerDown={onDown(item)}
            onContextMenu={onContext(item)}
            style={{ cursor: 'grab' }} />
    );

    // Data-driven props: the old per-type renderers were identical apart from
    // footprint, rotation support, and the barrel's circular hit area.
    // A placed two-cell prop spans gridX (wide) or gridY (tall); markers spin
    // about the CURRENT orientation's footprint centre, so every angle lands
    // centred on its cells. Sprite art (Blender top-down PNG) replaces the
    // legacy inline SVG symbol whenever it exists — same footprint either way.
    const renderProp = (item, opts) => {
        if (!isVisible(item)) return null;
        const g = propGeometry(item, opts, gridCenterX, gridCenterY);
        const { cx, cy, bw, bh, boxW, boxH, transform } = g;
        const art = itemSpriteHref(item.type);
        // Drag highlight geometry per legacy contract: barrel circle (r+4),
        // firepit circle r=18 over a rect hit area, everything else rect.
        const hlCircle = opts.circle || opts.circleHl;
        const hlR = opts.circle ? RADIUS + 4 : SPRITE / 2;
        const visual = art ? (
            <image
                href={art}
                x={cx - bw / 2}
                y={cy - bh / 2}
                width={bw}
                height={bh}
                opacity={itemOpacity(item)}
                transform={transform}
            />
        ) : (
            // Ghost lane (bug-unregistered-placeditem-type-invisible-ghost):
            // every DISPATCHED type has Blender art, so reaching this branch
            // means the row's type is unknown to the app (legacy or AI-invented)
            // and no `#${item.type}` symbol exists — the old per-type `<use>`
            // resolved to nothing and the row vanished. Render the shared
            // "?" placeholder instead so the marker stays selectable.
            <use
                href="#generic-prop"
                x={cx - bw / 2}
                y={cy - bh / 2}
                opacity={itemOpacity(item)}
                transform={transform}
            />
        );
        const dragChrome = (
            <>
                {opts.circle ? (
                    <circle cx={cx} cy={cy} r={RADIUS} fill="transparent" className="item-hit-area placed-hit-area"
                        onPointerDown={onDown(item)}
                        onContextMenu={onContext(item)}
                        style={{ cursor: 'grab' }} />
                ) : rectHitArea(item, cx - boxW / 2, cy - boxH / 2, boxW, boxH)}
                {isDragging(item) && (hlCircle ? (
                    <circle cx={cx} cy={cy} r={hlR} fill="none" className="reposition-highlight" />
                ) : (
                    <rect x={cx - boxW / 2} y={cy - boxH / 2} width={boxW} height={boxH} fill="none" className="reposition-highlight" />
                ))}
            </>
        );
        return (
            <g key={item.id} className="placed-item" title={placedItemLabel(item)}>
                {visual}
                {isLocalhost && dragChrome}
            </g>
        );
    };

    const propRenderers = {
        altar: { wide: true, rotatable: true },
        arrowSlitWall: { rotatable: true },
        barrel: { circle: true },
        bed: { wide: true, rotatable: true },
        bookshelf: { wide: true, rotatable: true },
        boulder: {},
        bush: {},
        chair: { rotatable: true },
        chest: {},
        crate: {},
        firepit: { circleHl: true },
        fountain: {},
        pillar: {},
        secretDoor: { rotatable: true },
        skeleton: { rotatable: true },
        stairs: { rotatable: true },
        statue: {},
        table: { wide: true, rotatable: true },
        torch: { rotatable: true },
        trap: {},
        tree: {},
        web: {},
    };

    const renderDoor = (item) => {
        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);
        if (!isVisible(item)) return null;
        const isOpen = !!item.open;
        const art = itemSpriteHref('door');
        const transform = item.rotation ? `rotate(${item.rotation}, ${cx}, ${cy})` : undefined;
        return (
            <g key={item.id} className="placed-item" title={placedItemLabel(item)}>
                {!isOpen ? (
                    art ? (
                        <image href={art} x={cx - 18} y={cy - 18} width={SPRITE} height={SPRITE}
                            opacity={itemOpacity(item)} transform={transform} />
                    ) : (
                        <use href="#door" x={cx - 18} y={cy - 18} opacity={itemOpacity(item)} transform={transform} />
                    )
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
                        {rectHitArea(item, cx - 18, cy - 18, 36, 36)}
                        {isDragging(item) && (
                            <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    // Creature-token marker — ONE visual for both creature types so AI-Dress
    // monster tokens ride the exact machinery NPC tokens proved (title label,
    // fog dim, image slot, drag + right-click hit areas). Monsters read
    // distinct: purple ring (.monster-circle) + skull glyph instead of the
    // name initial.
    const renderCreature = (item, isMonster) => {
        const cx = gridCenterX(item.gridX);
        const cy = gridCenterY(item.gridY);
        if (!isVisible(item)) return null;
        const npcOpacity = itemOpacity(item);
        const npcImage = npcImages[item.name] || item.imageUrl;
        // Same-cell stacking offset (GA 2026-11-10): undefined for single
        // tokens and stack tops (byte-unchanged), a translate for buried ones.
        const stack = tokenStackTransform(tokenOffsets, item.id);
        const stacked = isStackedToken(tokenOffsets, item.id);

        return (
            <g key={item.id}
                className={stack ? 'npc-group token-buried' : 'npc-group'}
                title={placedItemLabel(item)}
                transform={stack}>
                <defs>
                    <clipPath id={`npc-clip-${item.id}`}>
                        <circle cx={cx} cy={cy} r={20} />
                    </clipPath>
                </defs>
                <circle cx={cx} cy={cy} r={20} className={isMonster ? 'npc-circle monster-circle' : 'npc-circle'} style={{ opacity: npcOpacity }} />
                {npcImage ? (
                    <image
                        xlinkHref={npcImage}
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
                        {isMonster ? '☠' : item.name.charAt(0).toUpperCase()}
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
                        {/* Stacked-cell tokens (top AND buried) swap the
                            40×40 cell rect for a circle matching the token art
                            itself (the barrel circle-hit precedent): a
                            shifted/oversized transparent rect would invisibly
                            steal presses from pixels where another token is
                            what the user sees. Circle hit = painted hit, so
                            paint order alone decides the grab — the visually
                            topmost token under the pointer always wins. */}
                        {stacked ? (
                            <circle cx={cx} cy={cy} r={RADIUS} fill="transparent"
                                className="placed-hit-area"
                                onPointerDown={onDown(item)}
                                onContextMenu={onContext(item)}
                                style={{ cursor: 'grab' }} />
                        ) : (
                            <rect
                                x={cx - RADIUS}
                                y={cy - RADIUS}
                                width={RADIUS * 2}
                                height={RADIUS * 2}
                                fill="transparent"
                                className="placed-hit-area"
                                onPointerDown={onDown(item)}
                                onContextMenu={onContext(item)}
                                style={{ cursor: 'grab' }}
                            />
                        )}
                        {isDragging(item) && (
                            <circle cx={cx} cy={cy} r={RADIUS + 4} fill="none" className="reposition-highlight" />
                        )}
                    </>
                )}
            </g>
        );
    };

    const renderItems = (type, renderFn) => placedItems.filter(i => i.type === type).map(renderFn).filter(Boolean)

    // Ghost lane (bug-unregistered-placeditem-type-invisible-ghost): the map
    // API and AI-Dress `add item` ops accept any non-empty `type`, but the
    // dispatch below is a fixed whitelist — unknown rows used to render zero
    // DOM (no sprite, no hit area) and were unselectable/undeletable ghosts.
    // One final pass renders them via renderProp's `#generic-prop` placeholder
    // (single-cell, non-rotatable) so every persisted row stays touchable.
    const dispatchedTypes = new Set([
        ...Object.keys(propRenderers), 'door', 'npc', 'monster',
    ]);
    const ghosts = placedItems.filter(i => !dispatchedTypes.has(i.type));

    return (
        <>
            {renderItems('altar', i => renderProp(i, propRenderers.altar))}
            {renderItems('arrowSlitWall', i => renderProp(i, propRenderers.arrowSlitWall))}
            {renderItems('barrel', i => renderProp(i, propRenderers.barrel))}
            {renderItems('bed', i => renderProp(i, propRenderers.bed))}
            {renderItems('bookshelf', i => renderProp(i, propRenderers.bookshelf))}
            {renderItems('boulder', i => renderProp(i, propRenderers.boulder))}
            {renderItems('bush', i => renderProp(i, propRenderers.bush))}
            {renderItems('chair', i => renderProp(i, propRenderers.chair))}
            {renderItems('chest', i => renderProp(i, propRenderers.chest))}
            {renderItems('crate', i => renderProp(i, propRenderers.crate))}
            {renderItems('door', renderDoor)}
            {renderItems('firepit', i => renderProp(i, propRenderers.firepit))}
            {renderItems('fountain', i => renderProp(i, propRenderers.fountain))}
            {renderItems('monster', i => renderCreature(i, true))}
            {renderItems('npc', i => renderCreature(i, false))}
            {renderItems('pillar', i => renderProp(i, propRenderers.pillar))}
            {renderItems('secretDoor', i => renderProp(i, propRenderers.secretDoor))}
            {renderItems('skeleton', i => renderProp(i, propRenderers.skeleton))}
            {renderItems('stairs', i => renderProp(i, propRenderers.stairs))}
            {renderItems('statue', i => renderProp(i, propRenderers.statue))}
            {renderItems('table', i => renderProp(i, propRenderers.table))}
            {renderItems('torch', i => renderProp(i, propRenderers.torch))}
            {renderItems('trap', i => renderProp(i, propRenderers.trap))}
            {renderItems('tree', i => renderProp(i, propRenderers.tree))}
            {renderItems('web', i => renderProp(i, propRenderers.web))}
            {ghosts.map(i => renderProp(i, {})).filter(Boolean)}
        </>
    );
}

export default PlacedItems;
