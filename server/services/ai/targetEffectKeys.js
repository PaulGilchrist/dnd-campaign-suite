/**
 * Referee target_effect key allowlist — derived from the single source of truth.
 *
 * The te registry (src/services/combat/conditions/targetEffectDefinitions.js)
 * is the contract for which `effect` keys the apply lane accepts, but it
 * cannot be imported server-side (it pulls in the client runtime-store hooks).
 * So we parse its raw source instead: every definition carries exactly one
 * `effect: 'key',` line, so the registry file remains the ONLY copy — an
 * effect added there shows up in the referee prompt with zero hand-maintenance.
 * Drift guard: targetEffectKeys.test.js asserts the parsed set equals the
 * keys of the actual imported TARGET_EFFECT_DEFINITIONS, so a parser/format
 * divergence fails the suite. Mirrors monsterActions.js (read once, cache).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const REGISTRY_PATH = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../src/services/combat/conditions/targetEffectDefinitions.js'
);

/** Extract the `effect: 'key',` definition keys from registry source text. */
export function parseTargetEffectKeys(source) {
    const keys = [];
    for (const m of String(source).matchAll(/^\s*effect:\s*'([A-Za-z0-9_]+)',?\s*$/gm)) {
        keys.push(m[1]);
    }
    return [...new Set(keys)];
}

let cache = null; // parsed keys (reloaded per process only)

/** @returns {string[]} every registry effect key ('speed_half', …); [] on read failure */
export function loadTargetEffectKeys() {
    if (cache) return cache;
    try {
        cache = parseTargetEffectKeys(fs.readFileSync(REGISTRY_PATH, 'utf8'));
        if (cache.length === 0) {
            console.error('[ai:targetEffectKeys] found no effect keys in the registry — did the file or its format move?');
        }
    } catch (e) {
        console.error('[ai:targetEffectKeys] failed to read targetEffectDefinitions.js:', e);
        cache = [];
    }
    return cache;
}
