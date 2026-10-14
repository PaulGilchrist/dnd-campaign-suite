// @improved-by-ai
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
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
  getAttackerTargetName: vi.fn(),
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

const CAMPAIGN = 'test-campaign';

function renderSpells(props = {}) {
  return render(<CharSpells
    playerStats={mockPlayerStats}
    campaignName={CAMPAIGN}
    mapName="test-map"
    characters={[]}
    setModalState={vi.fn()}
    {...props}
  />);
}

// Stub the three combat-context lookups the seam depends on, explicitly per
// test, so no test inherits another test's stubbed return values.
function stubTargetSources({ combatSummary = null, target = null, overlayName = null } = {}) {
  vi.mocked(getCombatContext).mockResolvedValue(combatSummary);
  vi.mocked(getTargetFromAttacker).mockReturnValue(target);
  vi.mocked(getAttackerTargetName).mockReturnValue(overlayName);
}

// Render CharSpells and hand back the getTargetInfo it passed to the spell
// cast executor, asserting SP-097's contract (a real function, not a null
// stub) before any test invokes the seam.
function renderAndGetTargetInfo(props = {}) {
  renderSpells(props);
  const { getTargetInfo } = vi.mocked(useSpellCastExecutor).mock.calls.at(-1)[0];
  expect(typeof getTargetInfo).toBe('function');
  return getTargetInfo;
}

describe('CharSpells getTargetInfo seam (SP-097)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves to the attacker\'s target creature and skips the overlay lookup', async () => {
    const thug = { name: 'Thug 1' };
    const combatSummary = { creatures: [{ name: mockPlayerStats.name, targetName: 'Thug 1' }] };
    stubTargetSources({ combatSummary, target: thug });

    const getTargetInfo = renderAndGetTargetInfo();

    // The full target object is handed through untouched, not a copy.
    await expect(getTargetInfo()).resolves.toBe(thug);
    expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN);
    expect(getTargetFromAttacker).toHaveBeenCalledWith(combatSummary, mockPlayerStats.name);
    expect(getAttackerTargetName).not.toHaveBeenCalled();
  });

  it('falls back to the overlay attacker target name when no target creature is selected', async () => {
    const combatSummary = { creatures: [{ name: mockPlayerStats.name, targetName: 'Thug 1' }] };
    stubTargetSources({ combatSummary, target: null, overlayName: 'Thug 1' });

    const getTargetInfo = renderAndGetTargetInfo();

    await expect(getTargetInfo()).resolves.toEqual({ name: 'Thug 1' });
    expect(getTargetFromAttacker).toHaveBeenCalledWith(combatSummary, mockPlayerStats.name);
    expect(getAttackerTargetName).toHaveBeenCalledWith(combatSummary, mockPlayerStats.name);
  });

  it('returns null when there is no combat context, without consulting target lookups', async () => {
    stubTargetSources({ combatSummary: null });

    const getTargetInfo = renderAndGetTargetInfo();

    await expect(getTargetInfo()).resolves.toBeNull();
    expect(getTargetFromAttacker).not.toHaveBeenCalled();
    expect(getAttackerTargetName).not.toHaveBeenCalled();
  });

  it('returns null when combat context has neither a selected target nor an overlay name', async () => {
    const combatSummary = { creatures: [{ name: mockPlayerStats.name, targetName: null }] };
    stubTargetSources({ combatSummary, target: null, overlayName: null });

    const getTargetInfo = renderAndGetTargetInfo();

    await expect(getTargetInfo()).resolves.toBeNull();
    expect(getTargetFromAttacker).toHaveBeenCalledWith(combatSummary, mockPlayerStats.name);
    expect(getAttackerTargetName).toHaveBeenCalledWith(combatSummary, mockPlayerStats.name);
  });
});
