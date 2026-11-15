// @maintained-by-ai: 2026-11-15
// SKIP PAY-STATE GATE (bug-revivify-chooser-skip-rollback-inflates-unspent-slot):
// The gated chooser family arms pending UNPAID (spellGates → makePending never
// spends; createConfirmHandler pays via prepareSpellCast at CONFIRM). The old
// createSkipHandler refunded + logged UNCONDITIONALLY, so one Skip on the
// Revivify corpse-chooser credited spell_slots_level_3 ABOVE class max
// (observed live: 3→4 on a lv8 cleric, repeatable) and stamped a phantom
// type:'spell' cast row. createSkipHandler now gates on the ACTUAL paid state
// (pending.slotConsumed — the money-state twin of the 82b66bdef
// pending.castRefused precedent, stamped by createConfirmHandler's pay seam):
//  - unpaid pending  → dismiss only: zero addEntry, zero rollbackSpellSlot POST,
//    pending cleared (§11 unpaid-lane law, sibling zero-spend dismiss family:
//    HoH-picker Cancel / heal-chooser refusals / SP-093 PfE skip);
//  - paid pending    → the refund pair stays byte-identical, incl. the CLA-086
//    upcast-level refund (refund at spell.upcastLevel || spellLevel) and the
//    cast row at the base pending.spellLevel.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConfirmableFlow } from './useConfirmableFlow.js';
import { addEntry } from '../../services/ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { incrementFreeCastResource } from '../../services/rules/spells/spellPreparationService.js';

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// Slot ledger: available = 3 at every level → a refund is observable as
// setRuntimeValue(name, 'spell_slots_level_N', 4, campaign).
vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {}, slotConsumed: true })),
  isFreeCastAuthorized: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve(null)),
  triggerBewitchingMagic: vi.fn(() => Promise.resolve(null)),
}));

const CAMPAIGN = 'test-campaign';
const playerStats = { name: 'War_Cleric', class: { name: 'Cleric' }, level: 8 };

// The live Revivify chooser pending, exactly as gateRevivify → makePending
// builds it (spellGateHelpers.js): NO paid stamp — confirm pays.
const makeUnpaidPending = (overrides = {}) => ({
  spellName: 'Revivify',
  spell: { name: 'Revivify', level: 3 },
  spellLevel: 3,
  castingTime: '1 action',
  range: 'Touch',
  creatureTargets: ['AasimarTest'],
  ...overrides,
});

const slotWrites = () => setRuntimeValue.mock.calls.filter(c => String(c[1]).includes('spell_slots'));

describe('useConfirmableFlow — skip pay-state gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('UNPAID pending (Revivify chooser face): skip dismisses with ZERO writes and clears pending', () => {
    const { result } = renderHook(() => useConfirmableFlow(playerStats, CAMPAIGN));
    act(() => result.current.setPending('revivify', makeUnpaidPending()));
    expect(result.current.hasPending).toBe(true);

    act(() => result.current.createSkipHandler('revivify', (pending) => pending.creatureTargets)());

    // Pending dismissed, UI back to normal…
    expect(result.current.getPending('revivify')).toBeNull();
    expect(result.current.hasPending).toBe(false);
    // …with nothing left to pay back: no phantom cast row, no slot refund,
    // no free-cast resource credit — a byte-empty write census.
    expect(addEntry).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(slotWrites()).toHaveLength(0);
    expect(incrementFreeCastResource).not.toHaveBeenCalled();
  });

  it('UNPAID free-cast spell (aid): skip credits neither a slot NOR the free-cast resource', () => {
    const { result } = renderHook(() => useConfirmableFlow(playerStats, CAMPAIGN));
    act(() => result.current.setPending('aid', makeUnpaidPending({
      spellName: 'Aid',
      spell: { name: 'Aid', level: 2 },
      spellLevel: 2,
    })));

    act(() => result.current.createSkipHandler('aid', (pending) => pending.creatureTargets)());

    expect(result.current.getPending('aid')).toBeNull();
    expect(addEntry).not.toHaveBeenCalled();
    expect(incrementFreeCastResource).not.toHaveBeenCalled();
    expect(slotWrites()).toHaveLength(0);
  });

  it('PAID pending: skip keeps the base-level refund pair byte-identical', () => {
    const { result } = renderHook(() => useConfirmableFlow(playerStats, CAMPAIGN));
    // A genuinely paid pending — pending.slotConsumed is stamped by the
    // confirm-lane pay seam (createConfirmHandler → prepareSpellCast); an
    // arm-time payer stamps the same flag before the chooser opens.
    act(() => result.current.setPending('cureWounds', makeUnpaidPending({
      spellName: 'Cure Wounds',
      spell: { name: 'Cure Wounds', level: 1 },
      spellLevel: 1,
      slotConsumed: true,
    })));

    act(() => result.current.createSkipHandler('cureWounds', (pending) => pending.creatureTargets)());

    expect(result.current.getPending('cureWounds')).toBeNull();
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'spell',
      characterName: 'War_Cleric',
      targetName: 'AasimarTest',
      targets: ['AasimarTest'],
      spellName: 'Cure Wounds',
      spellLevel: 1,
      castingTime: '1 action',
      timestamp: expect.any(Number),
    });
    // Available 3 → refund 4 at the paid level.
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('War_Cleric', 'spell_slots_level_1', 4, CAMPAIGN);
  });

  it('PAID upcast pending: CLA-086 refund at the level actually consumed (upcast, not base)', () => {
    const { result } = renderHook(() => useConfirmableFlow(playerStats, CAMPAIGN));
    act(() => result.current.setPending('cureWounds', makeUnpaidPending({
      spellName: 'Cure Wounds',
      spell: { name: 'Cure Wounds', level: 1, upcastLevel: 3 },
      spellLevel: 1,
      slotConsumed: true,
    })));

    act(() => result.current.createSkipHandler('cureWounds', (pending) => pending.creatureTargets)());

    // lv3 read back and refunded at lv3 (2 → … mock ledger 3 → 4); lv1 stays dark.
    expect(getRuntimeValue).toHaveBeenCalledWith('War_Cleric', 'spell_slots_level_3');
    expect(setRuntimeValue).toHaveBeenCalledWith('War_Cleric', 'spell_slots_level_3', 4, CAMPAIGN);
    expect(setRuntimeValue.mock.calls.filter(c => c[1] === 'spell_slots_level_1')).toHaveLength(0);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      type: 'spell',
      spellName: 'Cure Wounds',
      spellLevel: 1,
    }));
  });

  it('confirm pay seam stamps slotConsumed on the pending (the gate flag has a real producer)', async () => {
    const { result } = renderHook(() => useConfirmableFlow(playerStats, CAMPAIGN));
    let seen = null;
    const confirm = result.current.createConfirmHandler(
      'revivify',
      (pending) => { seen = pending; },
      () => ['AasimarTest'],
      { deferCastLog: true }
    );
    act(() => result.current.setPending('revivify', makeUnpaidPending()));
    await act(async () => { await confirm({ targetName: 'AasimarTest' }); });

    expect(seen).not.toBeNull();
    expect(seen.slotConsumed).toBe(true);
  });

  it('cantrip confirm pays nothing and stamps nothing (paid lane stays honest)', async () => {
    const { result } = renderHook(() => useConfirmableFlow(playerStats, CAMPAIGN));
    let seen = null;
    const confirm = result.current.createConfirmHandler('light', (pending) => { seen = pending; });
    act(() => result.current.setPending('light', makeUnpaidPending({
      spellName: 'Light',
      spell: { name: 'Light', level: 0 },
      spellLevel: 0,
    })));
    await act(async () => { await confirm({}); });

    expect(seen.slotConsumed).toBeUndefined();
  });
});
