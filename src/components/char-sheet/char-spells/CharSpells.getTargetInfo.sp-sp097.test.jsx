import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';
import { mockPlayerStats } from './CharSpells.test-utils.js';
import { useSpellCastExecutor } from '../../../hooks/combat/useSpellCastExecutor.js';
import { getCombatContext, getTargetFromAttacker, getAttackerTargetName } from '../../../services/rules/combat/damageUtils.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => []),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  default: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  })),
}));

vi.mock('../../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ setPopupHtml: vi.fn() })),
}));

vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
  })),
}));

vi.mock('../../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    pendingUpcast: null,
    buildUpcastLevels: vi.fn(() => []),
    handleUpcastConfirm: vi.fn(),
    handleUpcastCancel: vi.fn(),
  })),
}));

vi.mock('../../../hooks/combat/useSpellCastExecutor.js', () => ({
  useSpellCastExecutor: vi.fn(() => ({ castAction: vi.fn() })),
}));

vi.mock('../../../hooks/combat/useSpellPositionResolver.js', () => ({
  useSpellPositionResolver: vi.fn(() => ({
    resolvePositions: vi.fn(() => Promise.resolve()),
    cachedPosRef: { current: null },
  })),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
  getTargetFromAttacker: vi.fn(() => null),
  getAttackerTargetName: vi.fn(() => null),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../useAttackDamageResolution.js', () => ({
  normalizeAutoDamage: vi.fn(() => ({ attack: { name: 'Fire Bolt' }, ctx: {} })),
  resolveAttackDamageStandalone: vi.fn(() => Promise.resolve()),
}));

vi.mock('./CharSpellSlots.jsx', () => ({
  default: function CharSpellSlots() {
    return <div data-testid="char-spell-slots">Spell Slots</div>;
  },
}));

vi.mock('./SpellTargetPopups.jsx', () => ({
  default: function SpellTargetPopups() {
    return <div data-testid="spell-target-popups" />;
  },
}));

vi.mock('./CreatureTargetPopups.jsx', () => ({
  default: function CreatureTargetPopups() {
    return <div data-testid="creature-target-popups" />;
  },
}));

vi.mock('./TargetSpellPopups.jsx', () => ({
  default: function TargetSpellPopups() {
    return <div data-testid="target-spell-popups" />;
  },
}));

function renderSpells() {
  return render(<CharSpells
    playerStats={mockPlayerStats}
    campaignName="test-campaign"
    mapName="test-map"
    characters={[]}
    setModalState={vi.fn()}
  />);
}

function getCastExecutorTargetInfo() {
  const call = vi.mocked(useSpellCastExecutor).mock.calls.at(-1);
  return call[0].getTargetInfo;
}

describe('CharSpells getTargetInfo seam (SP-097)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCombatContext).mockResolvedValue(null);
    vi.mocked(getTargetFromAttacker).mockReturnValue(null);
    vi.mocked(getAttackerTargetName).mockReturnValue(null);
  });

  it('passes a real getTargetInfo function into useSpellCastExecutor (not a null stub)', async () => {
    const { getTargetFromAttacker } = await import('../../../services/rules/combat/damageUtils.js');
    const cs = { creatures: [{ name: mockPlayerStats.name, targetName: 'Thug 1' }] };
    vi.mocked(getCombatContext).mockResolvedValue(cs);
    vi.mocked(getTargetFromAttacker).mockReturnValue({ name: 'Thug 1' });

    renderSpells();

    const getTargetInfo = getCastExecutorTargetInfo();
    expect(typeof getTargetInfo).toBe('function');
    await expect(getTargetInfo()).resolves.toEqual({ name: 'Thug 1' });
    expect(getCombatContext).toHaveBeenCalledWith('test-campaign');
    expect(getTargetFromAttacker).toHaveBeenCalledWith(cs, mockPlayerStats.name);
  });

  it('falls back to overlay attacker target name when no target creature found', async () => {
    const cs = { creatures: [{ name: mockPlayerStats.name, targetName: 'Thug 1' }] };
    vi.mocked(getCombatContext).mockResolvedValue(cs);
    vi.mocked(getTargetFromAttacker).mockReturnValue(null);
    vi.mocked(getAttackerTargetName).mockReturnValue('Thug 1');

    renderSpells();

    await expect(getCastExecutorTargetInfo()()).resolves.toEqual({ name: 'Thug 1' });
  });

  it('returns null when there is no combat context', async () => {
    vi.mocked(getCombatContext).mockResolvedValue(null);

    renderSpells();

    await expect(getCastExecutorTargetInfo()()).resolves.toBeNull();
    expect(getTargetFromAttacker).not.toHaveBeenCalled();
  });
});
