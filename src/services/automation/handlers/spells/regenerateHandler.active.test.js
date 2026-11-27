// @maintained-by-ai 2026-11-27
// ── regenerate QUARTET seam map (shared subject: regenerateHandler.js) ──────────
//   #1946 .active   (this) — audit + load-guard lane: dead-export census and
//                     duration-policy verification for the ACTIVE-regen flag. No
//                     behavioral pins: every active-flag READ seam is owned and
//                     pinned STRONGER in its home file (table below).
//   #1947 .apply    — applyRegenerateEffect healing application (expression
//                     resolution, max-HP clamp, applyHealingToTarget, logs, badge,
//                     and the subject's ONLY regenerateActive write pin, L207-211
//                     exact-array census: [['Goblin','regenerateActive',true,c]]).
//   #1948 .sp096    — FIX-SPECIFIC lock lane: SP-096 PC maxHp from runtime
//                     hitPoints vs combatSummary 1/1 placeholder, honest zero-heal
//                     message, monster-lane byte-identical. Lock-only; badge
//                     stamp pins shed to #1947 (#1948's L11/L164 shed notes).
//   #1949 .test     — main: handle() orchestration — spell-name match, combat
//                     context popup fallback, regenerate_target_selection payload.
//
// Export liveness (repo-wide grep incl. string dispatch, RE-VERIFIED 2026-11-27):
//   · handle                — LIVE: index.js imports at L14, registers
//                         `regenerate: handleRegenerate` at L614. Owned by #1949.
//   · applyRegenerateEffect — LIVE: index.js re-export L647; consumed by the
//                         regenerate_target_selection popup confirm via
//                         regenerateService.confirmRegenerate. Owned by
//                         #1947 (+ #1948 fix locks).
//   · isRegenerateActive (source L192-195) — DEAD EXPORT, still unpinned. Zero
//                         production callers (grep 2026-11-27: only the source
//                         definition + sibling-header prose). Every live reader
//                         of the 'regenerateActive' runtime key reads it
//                         directly (truthy, NOT via this strict-=== predicate):
//                         turnStartEffects.js L279 (fallback tick gate) and L454
//                         (typed-row gate), restRules-shortRest.js L409,
//                         restRules-longRest.js L359, useInitiativeEffects.js
//                         L274, clearExpirationEffects.js L575
//                         ('remove_regenerate_buff' →
//                         clearFlagKeys(['regenerateActive','regenerateSource'])).
//                         Per tally precedent #1916 the predicate describe stays
//                         REMOVED — recommend deleting the export from
//                         regenerateHandler.js; its removal also retires a
//                         divergent second definition of "active" (strict
//                         === true vs the truthy reads live consumers use) and
//                         would orphan nothing (import at source L1 is shared
//                         with the live stamp path).
//
// Duration/timers policy audit (RE-VERIFIED against current bytes 2026-11-27):
// regenerateHandler.js stores NO duration — no addExpiration, no round
// countdown, no setTimeout/setInterval; Date.now() appears only as log-row
// timestamps (benign allowlist category). The ≥1-hour spell duration is
// combat-scoped per owner canon: cleared at a new-initiative seam
// (useInitiativeEffects.js L274-275, full-HP restore + flag clear), short/long
// rest (restRules L409-411 / L359-361), and the
// spellCastService/execution/helpers.js L541-545 'remove_regenerate_buff'
// expiration — whose comment explicitly disavows a fabricated hour→round
// countdown (fix#336S/#1483). The stale "retired 600-rounds recipe" flag this
// header carried is RESOLVED — nothing to hand to the expiration-lane owner.
// Turn-based ✓.
//
// Active-flag READ-seam coverage map (why this lane adds zero behavioral tests):
//   • turn seam, typed disk-expression row: expirations_additional.test.js
//     L247-265 (fix#356(a) one-authoritative-writer exact-HP arithmetic,
//     stateful store, hpWrites toEqual [13]) + L284+ (flag-false zero-write leg).
//   • turn seam, flat-1 fallback tick (cast lanes stamp the flag without a
//     typed row — helpers.js:538, regenerateHandler.js:154):
//     expirations_additional.test.js L268-282 (exactly one +1 census) and
//     applyTurnStartEffects.test.js L250-272 (heal + count pin).
//   • initiative seam: useInitiativeEffects.invisibilityRegen.test.js L140+
//     (per-creature restore, other creatures' regen survives — owner ruling
//     2026-11-10).
//   • rest seams: restRules-shortRest.test.js L435+ / restRules-longRest.test.js
//     L732+ (per-creature clear censuses).
//   • expiration seam: clearExpirationEffects.test.js L396 (typed
//     remove_regenerate_buff row → clearFlagKeys).
// All five pins are stronger than anything restatable here (stateful stores,
// exact ordered write arrays, zero-spend censuses) — per no-duplication scout
// law, this lane does not mirror them.
//
// Monster-variant note (owner brief "fire/cold-paused RAW"): the pause-on-damage
// clause exists ONLY in bestiary trait prose (e.g. monsters.json revenant
// L55751 "Fire or Radiant damage ... doesn't function at the start of its next
// turn"); the cleric spell Regenerate in spells.json has no such clause and
// this handler implements none. Nothing to pin; any future monster-trait regen
// lane belongs to the trait subsystem, not this subject.
// ──────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

import { handle, applyRegenerateEffect } from './regenerateHandler.js';

describe('regenerateHandler active-predicate lane', () => {
    // isRegenerateActive describe REMOVED — dead export, see header census.
    // Load guard only: pins the module still resolves under the mocked runtime
    // seam and the exports index.js consumes (L614 registry + L647 re-export)
    // remain callable surface — fails loudly if the import at index.js L14
    // orphans or the module grows a load-time dependency on the runtime store.
    it('module loads with mocked runtime seams and exposes its live export surface', () => {
        expect(typeof handle).toBe('function');
        expect(typeof applyRegenerateEffect).toBe('function');
    });
});
