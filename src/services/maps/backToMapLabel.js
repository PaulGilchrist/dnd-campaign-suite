// @maintained-by-ai
/**
 * backToMapLabel — dynamic back-button label shared by BOTH board toolbars
 * (indoor map/MapToolbar.jsx, outdoor hex-map/HexMapToolbar.jsx).
 *
 * Backlog 2026-11-11 JV: with a non-empty map-history stack the App
 * handleBackFromMap press POPS the previous map, so the static
 * "Back to maps" title/aria lied about the destination. While the stack is
 * armed the button now names the map it will actually open; an empty stack
 * (or a legacy host passing no target) keeps the byte-identical
 * "Back to maps" chrome — zero change in the common case.
 *
 * Target shape mirrors the App.jsx history-stack entry
 * { mapName, mapDisplayName }: display name wins, the slug is title-cased
 * via the same formatMapName fallback the board headers use.
 */
import { formatMapName } from './mapsService.js';

export const BACK_TO_MAPS = 'Back to maps';

export function backToMapLabel(backTarget) {
    if (!backTarget || !backTarget.mapName) return BACK_TO_MAPS;
    return `Back to ${backTarget.mapDisplayName || formatMapName(backTarget.mapName)}`;
}
