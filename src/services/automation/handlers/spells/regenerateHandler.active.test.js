// @maintained-by-ai
// ── regenerate QUARTET seam map (shared subject: regenerateHandler.js) ──────────
//   #1946 .active   (this) — 'active'-predicate lane: isRegenerateActive reads.
//   #1947 .apply    — applyRegenerateEffect healing application (expression
//                     resolution, max-HP clamp, applyHealingToTarget, logs, badge,
//                     set-flag pin).
//   #1948 .sp096    — FIX-SPECIFIC lock lane: SP-096 PC maxHp from runtime
//                     hitPoints vs combatSummary 1/1 placeholder, honest zero-heal
//                     message, monster-lane byte-identical. Lock-only.
//   #1949 .test     — main: handle() orchestration — spell-name match, combat
//                     context popup fallback, regenerate_target_selection payload.
//
// Export liveness (repo-wide grep incl. string dispatch, verified 2026-10-16):
//   · handle              — LIVE: index.js imports at L14, registers
//                         `regenerate: handleRegenerate` at L614. Owned by #1949.
//   · applyRegenerateEffect — LIVE: index.js re-export L647; consumed by the
//                         regenerate_target_selection popup confirm. Owned by
//                         #1947 (+ #1948 fix locks).
//   · isRegenerateActive (source L192-195) — DEAD EXPORT. Zero production
//                         callers: index.js does not import it; every live reader
//                         of the 'regenerateActive' runtime key reads it directly
//                         (truthy, NOT via this strict-=== predicate):
//                         turnStartEffects.js L256/L425 (1 HP turn-start heal),
//                         restRules-shortRest.js L387 / restRules-longRest.js L305
//                         (full HP + flag clear), useInitiativeEffects.js L248
//                         (restore-at-initiative-seam), clearExpirationEffects.js
//                         L465 (remove_regenerate_buff → clearFlagKeys). Grep for
//                         the identifier as a dynamic-dispatch string: zero hits.
//                         Per tally precedent #1916: the predicate describe is
//                         REMOVED here — recommend deleting the export from
//                         regenerateHandler.js; the load guard below then fails
//                         loudly if its getRuntimeValue import is orphaned.
//                         Note: removing it also retires a divergent second
//                         definition of "active" (strict === true vs the truthy
//                         reads the live consumers actually use).
//
// Duration/timers policy audit (this subject): regenerateHandler.js stores NO
// duration — no addExpiration, no round countdown, no setTimeout. Flag lifecycle
// advances only at turn/initiative seams and rests (sources above). turn-based ✓.
// FLAG (foreign lane, eyebite #1906 family): the parallel cast lane in
// spellCastService/execution/helpers.js L477 stamps remove_regenerate_buff with
// the retired "1 hour = 3600s / 6 = 600 rounds" recipe comment — legacy
// minutes×N residue to hand to the expiration-lane owner, NOT fixed here.
//
// Handoff to #1947/#1948/#1949:
//   • #1947's 'should set regenerateActive=true on target' (L178) is now the
//     ONLY regenerateActive pin inside this subject — do not trim it.
//   • #1948's stamp pin (L125) is fix-specific — keep.
//   • #1949: handle() never READS the flag (write side lives in apply); do not
//     re-add predicate or turn-tick pins there. The 1 HP/turn turn-start tick is
//     turnStartEffects.js territory, already pinned in
//     applyTurnStartEffects.test.js L250-264, expirations_additional.test.js
//     L247/L268 — cites refreshed fix#336S/#1297 (old L241/L271/L293 + the
//     retired expirations_applyAuraDamage.test.js L524 pin died with #1137); no duplication.
// ──────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

import { handle, applyRegenerateEffect } from './regenerateHandler.js';

describe('regenerateHandler active-predicate lane', () => {
    // isRegenerateActive describe REMOVED — dead export, see header flag.
    // Load guard only: pins the module still resolves and the exports index.js
    // consumes (L614 registry + L647 re-export) remain callable surface.
    it('module loads with mocked runtime seams and exposes its live export surface', () => {
        expect(typeof handle).toBe('function');
        expect(typeof applyRegenerateEffect).toBe('function');
    });
});
