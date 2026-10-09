// CLA-033: the gated confirm lane bypasses executeSpellCast, so Beguiling
// Magic's post-cast rider never fired. createConfirmHandler must fire
// triggerPostCastRiderSaves after applyFn — and skip it when an applyFn
// runner (runHex/runAnimalFriendship) stamps postCastTriggersRan because it
// hands off to onExecute, whose runPostCastTriggers fires the rider itself.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConfirmableFlow } from './useConfirmableFlow.js';
import { triggerPostCastRiderSaves } from '../../services/rules/spells/postCastRiderService.js';

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve(null)),
}));

const playerStats = { name: 'Bard', automation: { passives: [] } };
const campaignName = 'test-campaign';

function makePending(overrides = {}) {
  return {
    spellName: 'Charm Person',
    spell: { name: 'Charm Person', level: 1, school: 'Enchantment' },
    spellLevel: 1,
    castingTime: 'Action',
    metaCtx: {},
    ...overrides,
  };
}

describe('CLA-033 gated confirm lane fires the post-cast rider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fires triggerPostCastRiderSaves with the paid slot level after applyFn', async () => {
    const { result } = renderHook(() => useConfirmableFlow(playerStats, campaignName));
    const applyFn = vi.fn();
    const confirm = result.current.createConfirmHandler('charmPerson', applyFn);

    act(() => result.current.setPending('charmPerson', makePending()));
    await act(async () => { await confirm({}); });

    expect(applyFn).toHaveBeenCalledTimes(1);
    expect(triggerPostCastRiderSaves).toHaveBeenCalledTimes(1);
    const [spell, metaCtx, stats, campaign] = triggerPostCastRiderSaves.mock.calls[0];
    expect(spell.name).toBe('Charm Person');
    expect(metaCtx.slotLevel).toBe(1);
    expect(stats).toBe(playerStats);
    expect(campaign).toBe(campaignName);
  });

  it('stamps the upcast paid level onto the rider metaCtx', async () => {
    const { result } = renderHook(() => useConfirmableFlow(playerStats, campaignName));
    const confirm = result.current.createConfirmHandler('charmPerson', vi.fn());

    act(() => result.current.setPending('charmPerson', makePending({
      spell: { name: 'Charm Person', level: 1, school: 'Enchantment', upcastLevel: 3 },
    })));
    await act(async () => { await confirm({}); });

    expect(triggerPostCastRiderSaves.mock.calls[0][1].slotLevel).toBe(3);
  });

  it('skips the seam when applyFn stamped postCastTriggersRan (onExecute lane)', async () => {
    const { result } = renderHook(() => useConfirmableFlow(playerStats, campaignName));
    const applyFn = vi.fn((pending) => { pending.postCastTriggersRan = true; });
    const confirm = result.current.createConfirmHandler('hex', applyFn);

    act(() => result.current.setPending('hex', makePending({ spellName: 'Hex' })));
    await act(async () => { await confirm({}); });

    expect(applyFn).toHaveBeenCalledTimes(1);
    expect(triggerPostCastRiderSaves).not.toHaveBeenCalled();
  });

  it('a rider rejection never rejects the confirm handler', async () => {
    triggerPostCastRiderSaves.mockRejectedValueOnce(new Error('rider boom'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useConfirmableFlow(playerStats, campaignName));
    const confirm = result.current.createConfirmHandler('charmPerson', vi.fn());

    act(() => result.current.setPending('charmPerson', makePending()));
    await expect(act(async () => { await confirm({}); })).resolves.toBeUndefined();

    errorSpy.mockRestore();
  });
});
