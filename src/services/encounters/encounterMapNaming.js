/**
 * Single source of truth for encounter battle-map display metadata
 * (backlog 2026-10-25 pm). Accepting a travel combat event spawns a fresh
 * arena per event; its raw kebab slug (`…---encounter-at-55`) used to be the
 * only label. Both the spawn lane (useEncounterGeneration) and the
 * auto-encounter audit (autoEncounterService → HexMap log copy) build the
 * label here so the Maps list and the log entry name the arena with the
 * exact same readable bytes: `"<Parent Map> - <Event Title> at (q,r)"`
 * (or `… - Encounter at (q,r)` for manual spawns without an event).
 * The on-disk fileName stays slug-shaped — it is still derived from this
 * display name via toKebabCase, exactly as before.
 */
import { formatMapName } from '../maps/mapsService.js';

export function buildEncounterMapDisplayName({ parentMapName, q, r, eventTitle = null }) {
    const parent = formatMapName(String(parentMapName || '').replace(/\.json$/i, '')) || 'Battle Map';
    const event = String(eventTitle || '').trim();
    return event
        ? `${parent} - ${event} at (${q},${r})`
        : `${parent} - Encounter at (${q},${r})`;
}
