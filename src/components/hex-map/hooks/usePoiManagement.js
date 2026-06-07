import { useState, useCallback } from 'react';
import { isRoadConnectable, findHexPath } from '../../../services/maps/hexMapUtils.js';
import { TOOL_ROAD } from '../../../config/outdoorConfig.js';

function usePoiManagement(pois, setPois, roads, setRoads, terrain, hexCols, hexRows, getHexFromEvent, tool) {
    const [selectedPoiMenu, setSelectedPoiMenu] = useState(null);
    const [showRename, setShowRename] = useState(null);
    const [poiDragging, setPoiDragging] = useState(null);
    const [roadStartPoiId, setRoadStartPoiId] = useState(null);

    const handlePoiPointerDown = useCallback((poiId, e) => {
        e.preventDefault();
        e.stopPropagation();

        if (tool === TOOL_ROAD) {
            const poi = pois.find(p => p.id === poiId);
            if (!poi) return;
            if (!isRoadConnectable(poi.type, poi.type)) {
                setRoadStartPoiId(null);
                return;
            }

            if (roadStartPoiId === null) {
                setRoadStartPoiId(poiId);
            } else if (roadStartPoiId === poiId) {
                setRoadStartPoiId(null);
            } else {
                const fromPoi = pois.find(p => p.id === roadStartPoiId);
                const toPoi = poi;
                if (!fromPoi || !toPoi) { setRoadStartPoiId(null); return; }

                const exists = roads.some(r =>
                    (r.fromPoiId === roadStartPoiId && r.toPoiId === poiId) ||
                    (r.toPoiId === roadStartPoiId && r.fromPoiId === poiId)
                );
                if (exists) {
                    setRoads(prev => prev.filter(r =>
                        !((r.fromPoiId === roadStartPoiId && r.toPoiId === poiId) ||
                          (r.toPoiId === roadStartPoiId && r.fromPoiId === poiId))
                    ));
                    setRoadStartPoiId(null);
                    return;
                }

                const path = findHexPath(fromPoi, toPoi, hexCols, hexRows, terrain);
                if (path) {
                    const newRoad = {
                        id: `road-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                        fromPoiId: roadStartPoiId,
                        toPoiId: poiId,
                        hexes: path.map(h => `${h.q},${h.r}`),
                    };
                    setRoads(prev => [...prev, newRoad]);
                }
                setRoadStartPoiId(null);
            }
            return;
        }

        const poi = pois.find(p => p.id === poiId);
        if (!poi) return;
        setPoiDragging({ poiId, startQ: poi.q, startR: poi.r });
    }, [pois, tool, roadStartPoiId, roads, terrain, hexCols, hexRows, setRoads]);

    const handlePoiPointerMove = useCallback((e) => {
        if (!poiDragging) return;
        const hex = getHexFromEvent(e);
        if (!hex) return;
        if (hex.q < 0 || hex.q >= hexCols || hex.r < 0 || hex.r >= hexRows) return;

        const exists = pois.some(p => p.id !== poiDragging.poiId && p.q === hex.q && p.r === hex.r);
        if (exists) return;

        setPois(prev => prev.map(p =>
            p.id === poiDragging.poiId ? { ...p, q: hex.q, r: hex.r } : p
        ));
    }, [poiDragging, pois, getHexFromEvent, hexCols, hexRows, setPois]);

    const handlePoiPointerUp = useCallback(() => {
        if (poiDragging) {
            const draggedId = poiDragging.poiId;
            setRoads(prev => prev.map(road => {
                if (road.fromPoiId === draggedId || road.toPoiId === draggedId) {
                    const otherPoiId = road.fromPoiId === draggedId ? road.toPoiId : road.fromPoiId;
                    const movedPoi = pois.find(p => p.id === draggedId);
                    const otherPoi = pois.find(p => p.id === otherPoiId);
                    if (movedPoi && otherPoi) {
                        const path = findHexPath(movedPoi, otherPoi, hexCols, hexRows, terrain);
                        if (path) {
                            return { ...road, hexes: path.map(h => `${h.q},${h.r}`) };
                        }
                    }
                }
                return road;
            }));
        }
        setPoiDragging(null);
    }, [poiDragging, pois, terrain, hexCols, hexRows, setRoads]);

    const handlePoiContextMenu = useCallback((poiId) => {
        const poi = pois.find(p => p.id === poiId);
        if (!poi) return;
        setSelectedPoiMenu({ id: poi.id, q: poi.q, r: poi.r });
    }, [pois]);

    const handleTogglePoiVisibility = useCallback((poiId) => {
        setPois(prev => prev.map(p =>
            p.id === poiId ? { ...p, visible: !p.visible } : p
        ));
        setSelectedPoiMenu(null);
    }, [setPois]);

    const handleDeletePoi = useCallback((poiId) => {
        setPois(prev => prev.filter(p => p.id !== poiId));
        setRoads(prev => prev.filter(r => r.fromPoiId !== poiId && r.toPoiId !== poiId));
        setSelectedPoiMenu(null);
    }, [setPois, setRoads]);

    const handleRenamePoi = useCallback((poiId, newLabel) => {
        setPois(prev => prev.map(p =>
            p.id === poiId ? { ...p, label: newLabel } : p
        ));
        setShowRename(null);
        setSelectedPoiMenu(null);
    }, [setPois]);

    const handleLinkMap = useCallback((poiId, mapName) => {
        setPois(prev => prev.map(p =>
            p.id === poiId ? { ...p, linkedMap: mapName } : p
        ));
        setSelectedPoiMenu(null);
    }, [setPois]);

    const handleUnlinkMap = useCallback((poiId) => {
        setPois(prev => prev.map(p =>
            p.id === poiId ? { ...p, linkedMap: undefined } : p
        ));
        setSelectedPoiMenu(null);
    }, [setPois]);

    const handleRemoveRoads = useCallback((poiId) => {
        setRoads(prev => prev.filter(r => r.fromPoiId !== poiId && r.toPoiId !== poiId));
    }, [setRoads]);

    return {
        selectedPoiMenu, setSelectedPoiMenu,
        showRename, setShowRename,
        poiDragging,
        roadStartPoiId, setRoadStartPoiId,
        handlePoiPointerDown, handlePoiPointerMove, handlePoiPointerUp,
        handlePoiContextMenu, handleTogglePoiVisibility, handleDeletePoi,
        handleRenamePoi, handleLinkMap, handleUnlinkMap, handleRemoveRoads,
    };
}

export default usePoiManagement;
