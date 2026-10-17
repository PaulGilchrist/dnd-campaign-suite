// @maintained-by-ai
// CLA-229 regression: Misty Wanderer declares automation
// [free_spell, misty_wanderer]. executeHandler's actionable scan must NOT
// let automation[0] (free_spell → handleSpellCast) shadow the companion-carry
// half — the Special Actions row dispatches mistyWandererHandler, which opens
// MistyWandererModal (free Misty Step + willing-companion picker).
//
// ── Registry QUINTET seam map (#1996-1999 + this lane, all through index.js) ──
// index.js = HANDLER_MAP table (L299-626) + resolveHandler (L675-700) +
// executeHandler (L702-749). Feature-named lanes pin one feature's registration
// key → resolveHandler routing → handler invocation shape; #1997 index.test.js
// owns the generic MECHANICS canon: null early-outs (L703-705, L738-740),
// error-catch popup (L745-748), generic auto-array scan incl. CLA-192
// replacesWarMagic prefer (L722), passive_rule/auto_effect table mechanics,
// damage_reduction (L341-347) / spell_modifier (L334) dispatchers. Feature
// lanes must not re-pin those mechanics; mechanics tests must not re-pin
// feature rows. Remaining siblings: #1996 psychicTeleportation owns the
// auto_effect→effect route (L686-691); #1998 warpingImplosion owns the
// save_attack sorcery_points+restoreCost fingerprint (L692-698); #1999
// webDispatch owns the web_area_save row/dispatch family (L557).
// THIS lane (mistyWanderer) owns EXCLUSIVELY:
//   • exact-key rows misty_wanderer L431 + free_spell L313 (shadowing half).
//     misty_wanderer_confirm L432 is registration symmetry only — no prod
//     dispatch references that type; the confirm lane calls the handler
//     directly (MistyWandererModal.jsx imports confirmMistyWanderer).
//   • the CLA-229 array prefer-branch (L723-728) — a feature-specific branch
//     naming misty_wanderer in prod code — reachable via the LIVE array shape:
//     classes.json(2024) [7]/majors[1]/features[4] (Fey Wanderer Ranger lv15,
//     verbatim in test 1) → buildItemSummary keeps the RAW automation array
//     (featureCategorizationUtils.js L25-31; both halves 'passive' so
//     resolveCastingTime L34-53 lands the row in specialActions) → rules.js
//     getActions L463 → row clickable (automationService INTERACTIVE list
//     L72 + array mirror scan, pinned automationService.interactive.
//     mistyWanderer.test.js) → CharSpecialActions handleAutomationClick
//     L801-808 executeHandler(action,…,characters) → array scan L716-734
//     (actionable filter L717-721 keeps both halves: casting_time + table
//     hit) → L727 prefer → resolveHandler table fallthrough L699 → invoke
//     L743 (5-arg forward; these calls pass 4 — characters undefined, benign
//     arity) → result pass-through L744 → modal dispatch (CharSpecialActions
//     L60 mistyWanderer → setMistyWandererModal). Control test pins the
//     actionable[0] tail (L728) so the prefer-branch, not generic order, is
//     what selects.
//   • handler internals live at handlers/class-warlock/mistyWandererHandler.js
//     with its own test home mistyWandererHandler.test.js (payload/pool/log
//     lanes) — registry-side shape only here.
// Prod liveness verified 2026-10-16: sole misty_wanderer data row is
// public/data/2024/classes.json (5e /data carries none — 2024-only feature,
// not pending wiring); executeHandler callers live (CharSpecialActions.jsx
// L808, useCharActionsAutomation.js L448). No timers; turn-based row-click
// dispatch only.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { executeHandler } from './index.js';

vi.mock('./handlers/spells/spellCastHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ result: 'free_spell_cast' }),
}));

vi.mock('./handlers/class-warlock/mistyWandererHandler.js', () => ({
  handle: vi.fn().mockResolvedValue({ type: 'modal', modalName: 'mistyWanderer', payload: { usesMax: 3 } }),
  confirmMistyWanderer: vi.fn(),
}));

const { handle: spellCastHandle } = await import('./handlers/spells/spellCastHandler.js');
const { handle: mistyWandererHandle } = await import('./handlers/class-warlock/mistyWandererHandler.js');

const playerStats = { name: 'FeyRanger', level: 15 };

describe('executeHandler — Misty Wanderer dispatch priority (CLA-229)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches misty_wanderer over the leading free_spell half', async () => {
    const action = {
      name: 'Misty Wanderer',
      automation: [
        { type: 'free_spell', spell: 'Misty Step', uses_expression: 'WIS modifier_min_1', recharge: 'long_rest', casting_time: 'passive', hasAutomation: true },
        { type: 'misty_wanderer', uses_expression: 'WIS modifier_min_1', recharge: 'long_rest', range: '5_ft', casting_time: 'passive', hasAutomation: true },
      ],
    };

    const result = await executeHandler(action, playerStats, 'test-campaign', null);

    expect(result).toEqual({ type: 'modal', modalName: 'mistyWanderer', payload: { usesMax: 3 } });
    expect(mistyWandererHandle).toHaveBeenCalledTimes(1);
    expect(spellCastHandle).not.toHaveBeenCalled();
  });

  it('still dispatches free_spell when no misty_wanderer sibling exists (control)', async () => {
    const action = {
      name: 'Fey Magic',
      automation: [
        { type: 'free_spell', spell: 'Misty Step', uses: 1, recharge: 'long_rest', casting_time: 'passive', hasAutomation: true },
      ],
    };

    const result = await executeHandler(action, playerStats, 'test-campaign', null);

    expect(result).toEqual({ result: 'free_spell_cast' });
    expect(spellCastHandle).toHaveBeenCalledTimes(1);
    expect(mistyWandererHandle).not.toHaveBeenCalled();
  });
});
