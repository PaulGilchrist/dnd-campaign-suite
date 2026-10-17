// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharActionSpellPopups from './CharActionSpellPopups.jsx';

// Stubs mirror each popup's real prop contract (see the production components):
// they echo host-supplied data so assertions verify how CharActionSpellPopups
// wires pending state → modal → handlers, nothing more.
// Ally-selection rows live in CharActionSpellPopups.creatureSelections.test.jsx,
// touch-target + forcecage lanes in .secondaryTargets.test.jsx, and the
// Greater Restoration 2-step flow in .greaterRestoration.test.jsx.

vi.mock('../common/popup.jsx', () => ({
  default: function TestPopup({ children }) {
    return <div data-testid="popup">{children}</div>;
  },
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: function TestMetamagicPopup({ spell, playerStats, campaignName, onConfirm, onSkip }) {
    return (
      <div data-testid="metamagic-popup">
        <span data-testid="metamagic-spell-name">{spell?.name}</span>
        <span data-testid="metamagic-spell-level">{spell?.level}</span>
        <span data-testid="metamagic-campaign">{campaignName}</span>
        <span data-testid="metamagic-is-psionic">{String(playerStats?._isPsionicSpell)}</span>
        <span data-testid="metamagic-psionic-cost">{String(playerStats?._psionicCost)}</span>
        {onConfirm && <button data-testid="metamagic-confirm" onClick={onConfirm}>Confirm</button>}
        {onSkip && <button data-testid="metamagic-skip" onClick={onSkip}>Skip</button>}
      </div>
    );
  },
}));

vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: function TestCreatureSelectionModal({ title }) {
    return <div data-testid={`creature-selection-${title}`} />;
  },
}));

// Touch-target specs always pass { name, type } creature objects.
vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: function TestSecondaryTargetModal({ title, targets, onTargetSelected, onSkip, description, confirmLabel }) {
    return (
      <div data-testid={`secondary-modal-${title}`}>
        <span data-testid="title">{title}</span>
        <span data-testid="description">{description}</span>
        <span data-testid="confirm-label">{confirmLabel}</span>
        {(targets || []).map((t, i) => (
          <span key={i} data-testid={`target-${i}`} onClick={() => onTargetSelected(t.name)}>{t.name}</span>
        ))}
        <button data-testid="skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: function TestSpellDetailPopup({ spell, playerStats, campaignName, playerLevel, upcastLevels, onClose, onCast }) {
    return (
      <div data-testid="spell-detail-popup">
        <span data-testid="detail-spell-name">{spell?.name}</span>
        <span data-testid="detail-spell-level">{spell?.level}</span>
        <span data-testid="detail-player-name">{playerStats?.name}</span>
        <span data-testid="detail-player-level">{playerLevel}</span>
        <span data-testid="detail-campaign">{campaignName}</span>
        <span data-testid="detail-upcast-count">{upcastLevels?.length}</span>
        {onClose && <button data-testid="detail-close" onClick={onClose}>Close</button>}
        {onCast && <button data-testid="detail-cast" onClick={onCast}>Cast</button>}
      </div>
    );
  },
}));

// onConfirm({ distribution }) mirrors the real popup's payload shape; tests
// only assert dispatch happened (payload assembly is the popup's own contract).
vi.mock('./popups/MagicMissileTargetPopup.jsx', () => ({
  default: function TestMagicMissileTargetPopup({ spell, totalMissiles, missileDamage, creatureTargets, currentTargetName, onConfirm, onSkip }) {
    return (
      <div data-testid="magic-missile-popup">
        <span data-testid="mm-spell-name">{spell?.name}</span>
        <span data-testid="mm-spell-level">{spell?.level}</span>
        <span data-testid="mm-total-missiles">{totalMissiles}</span>
        <span data-testid="mm-missile-damage">{missileDamage}</span>
        <span data-testid="mm-creature-count">{creatureTargets?.length}</span>
        <span data-testid="mm-current-target">{currentTargetName || 'none'}</span>
        {onConfirm && <button data-testid="mm-confirm" onClick={() => onConfirm({ distribution: {} })}>Confirm</button>}
        {onSkip && <button data-testid="mm-skip" onClick={onSkip}>Skip</button>}
      </div>
    );
  },
}));

const mockedDamageUtils = vi.hoisted(() => ({
  getTargetFromAttacker: vi.fn(() => null),
}));

const mockedCombatData = vi.hoisted(() => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => mockedDamageUtils);
vi.mock('../../services/encounters/combatData.js', () => mockedCombatData);

// No forcecage effects here — the blocking-rule lane is canonical in
// CharActionSpellPopups.secondaryTargets.test.jsx.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

function createBaseProps(overrides) {
  return {
    playerStats: { name: 'Test Character', level: 5 },
    campaignName: 'test-campaign',
    selectedActionSpell: null,
    setSelectedActionSpell: vi.fn(),
    buildUpcastLevels: vi.fn(() => []),
    handleActionSpellCast: vi.fn(),
    actionPendingMetamagic: null,
    actionHandleConfirm: vi.fn(),
    actionHandleSkip: vi.fn(),
    actionPendingAid: null,
    actionHandleAidConfirm: vi.fn(),
    actionHandleAidSkip: vi.fn(),
    actionPendingBane: null,
    actionHandleBaneConfirm: vi.fn(),
    actionHandleBaneSkip: vi.fn(),
    actionPendingBless: null,
    actionHandleBlessConfirm: vi.fn(),
    actionHandleBlessSkip: vi.fn(),
    actionPendingFaerieFire: null,
    actionHandleFaerieFireConfirm: vi.fn(),
    actionHandleFaerieFireSkip: vi.fn(),
    actionPendingBeaconOfHope: null,
    actionHandleBeaconOfHopeConfirm: vi.fn(),
    actionHandleBeaconOfHopeSkip: vi.fn(),
    actionPendingPassWithoutTrace: null,
    actionHandlePassWithoutTraceConfirm: vi.fn(),
    actionHandlePassWithoutTraceSkip: vi.fn(),
    actionPendingHaste: null,
    actionHandleHasteConfirm: vi.fn(),
    actionHandleHasteSkip: vi.fn(),
    actionPendingBarkskin: null,
    actionHandleBarkskinConfirm: vi.fn(),
    actionHandleBarkskinSkip: vi.fn(),
    actionPendingHeal: null,
    actionHandleHealConfirm: vi.fn(),
    actionHandleHealSkip: vi.fn(),
    actionPendingGreaterRestoration: null,
    actionHandleGreaterRestorationConfirm: vi.fn(),
    actionHandleGreaterRestorationSkip: vi.fn(),
    actionHandleGreaterRestorationNoEffects: vi.fn(),
    actionPendingRemoveCurse: null,
    actionHandleRemoveCurseConfirm: vi.fn(),
    actionHandleRemoveCurseSkip: vi.fn(),
    actionPendingMagicMissile: null,
    actionHandleMagicMissileConfirm: vi.fn(),
    actionHandleMagicMissileSkip: vi.fn(),
    actionPendingMageArmor: null,
    actionHandleMageArmorConfirm: vi.fn(),
    actionHandleMageArmorSkip: vi.fn(),
    actionPendingCureWounds: null,
    actionHandleCureWoundsConfirm: vi.fn(),
    actionHandleCureWoundsSkip: vi.fn(),
    actionPendingRevivify: null,
    actionHandleRevivifyConfirm: vi.fn(),
    actionHandleRevivifySkip: vi.fn(),
    pendingActionMetamagic: null,
    handleActionMetamagicConfirm: vi.fn(),
    handleActionMetamagicSkip: vi.fn(),
    ...overrides,
  };
}

describe('CharActionSpellPopups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders no popup, modal, or metamagic host when nothing is pending', () => {
    const { container } = render(<CharActionSpellPopups {...createBaseProps()} />);
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    expect(screen.queryByTestId('metamagic-popup')).not.toBeInTheDocument();
    expect(screen.queryByTestId('magic-missile-popup')).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid^="secondary-modal-"], [data-testid^="creature-selection-"]')).toHaveLength(0);
  });

  it('shows spell detail with upcast levels, casts through handleActionSpellCast, and closes through setSelectedActionSpell(null)', () => {
    const setSelectedActionSpell = vi.fn();
    const handleActionSpellCast = vi.fn();
    const buildUpcastLevels = vi.fn(() => [{ level: 3, availableSlots: 2 }, { level: 4, availableSlots: 1 }]);
    const spell = { name: 'Fireball', level: 3 };
    render(
      <CharActionSpellPopups
        {...createBaseProps({ setSelectedActionSpell, handleActionSpellCast, buildUpcastLevels })}
        selectedActionSpell={spell}
      />
    );
    expect(screen.getByTestId('popup')).toBeInTheDocument();
    expect(screen.getByTestId('detail-spell-name')).toHaveTextContent('Fireball');
    expect(screen.getByTestId('detail-spell-level')).toHaveTextContent('3');
    expect(screen.getByTestId('detail-player-level')).toHaveTextContent('5');
    expect(screen.getByTestId('detail-campaign')).toHaveTextContent('test-campaign');
    expect(buildUpcastLevels).toHaveBeenCalledWith(spell);
    expect(screen.getByTestId('detail-upcast-count')).toHaveTextContent('2');

    screen.getByTestId('detail-cast').click();
    expect(handleActionSpellCast).toHaveBeenCalledTimes(1);

    screen.getByTestId('detail-close').click();
    expect(setSelectedActionSpell).toHaveBeenCalledWith(null);
  });

  // One row per ActionMetamagicHost instance: the same host component drives both
  // the action-cast and base-action metamagic lanes through different handler props.
  const metamagicHosts = [
    { lane: 'action cast', pending: 'actionPendingMetamagic', confirm: 'actionHandleConfirm', skip: 'actionHandleSkip', foreignConfirm: 'handleActionMetamagicConfirm', spellName: 'Fireball' },
    { lane: 'base action', pending: 'pendingActionMetamagic', confirm: 'handleActionMetamagicConfirm', skip: 'handleActionMetamagicSkip', foreignConfirm: 'actionHandleConfirm', spellName: 'Dissonant Whispers' },
  ];

  it.each(metamagicHosts)(
    'metamagic lane ($lane): forwards spell + psionic data (CLA-271) and routes confirm/skip to its own handlers',
    ({ pending, confirm, skip, foreignConfirm, spellName }) => {
      const confirmFn = vi.fn();
      const skipFn = vi.fn();
      const foreignFn = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ [confirm]: confirmFn, [skip]: skipFn, [foreignConfirm]: foreignFn })}
          {...{ [pending]: { spellName, isPsionic: true, psionicCost: 1 } }}
        />
      );
      // spellLevel omitted → host defaults to 0
      expect(screen.getByTestId('metamagic-spell-name')).toHaveTextContent(spellName);
      expect(screen.getByTestId('metamagic-spell-level')).toHaveTextContent('0');
      expect(screen.getByTestId('metamagic-campaign')).toHaveTextContent('test-campaign');
      expect(screen.getByTestId('metamagic-is-psionic')).toHaveTextContent('true');
      expect(screen.getByTestId('metamagic-psionic-cost')).toHaveTextContent('1');

      screen.getByTestId('metamagic-confirm').click();
      expect(confirmFn).toHaveBeenCalledTimes(1);
      screen.getByTestId('metamagic-skip').click();
      expect(skipFn).toHaveBeenCalledTimes(1);
      expect(foreignFn).not.toHaveBeenCalled();
    }
  );

  // Remove Curse is the only touch-target spec whose description is a function
  // interpolating the spell's range — the discriminating row for that branch.
  it('Remove Curse interpolates its range into the description and casts with { targetName }', () => {
    const confirmFn = vi.fn();
    const skipFn = vi.fn();
    render(
      <CharActionSpellPopups
        {...createBaseProps({
          actionPendingRemoveCurse: { creatureTargets: ['Ally1'], range: 'Touch' },
          actionHandleRemoveCurseConfirm: confirmFn,
          actionHandleRemoveCurseSkip: skipFn,
        })}
      />
    );
    expect(screen.getByTestId('secondary-modal-Remove Curse')).toBeInTheDocument();
    expect(screen.getByTestId('description')).toHaveTextContent('Touch');
    expect(screen.getByTestId('confirm-label')).toHaveTextContent('Cast Remove Curse');
    expect(screen.getByTestId('target-0')).toHaveTextContent('Ally1');

    screen.getByTestId('target-0').click();
    expect(confirmFn).toHaveBeenCalledWith({ targetName: 'Ally1' });
    screen.getByTestId('skip').click();
    expect(skipFn).toHaveBeenCalledTimes(1);
  });

  it('wires Magic Missile metadata and current combat target, then dispatches confirm/skip', () => {
    const confirmFn = vi.fn();
    const skipFn = vi.fn();
    const summary = { creatures: [] };
    mockedCombatData.getCombatSummary.mockReturnValueOnce(summary);
    mockedDamageUtils.getTargetFromAttacker.mockReturnValueOnce({ name: 'Goblin' });
    render(
      <CharActionSpellPopups
        {...createBaseProps({
          actionPendingMagicMissile: {
            spell: { name: 'Magic Missile', level: 1 },
            totalMissiles: 3,
            missileDamage: '1d4+1',
            creatureTargets: ['Goblin', 'Hobgoblin'],
          },
          actionHandleMagicMissileConfirm: confirmFn,
          actionHandleMagicMissileSkip: skipFn,
        })}
      />
    );
    expect(mockedCombatData.getCombatSummary).toHaveBeenCalledWith('test-campaign');
    expect(mockedDamageUtils.getTargetFromAttacker).toHaveBeenCalledWith(summary, 'Test Character');
    expect(screen.getByTestId('mm-spell-name')).toHaveTextContent('Magic Missile');
    expect(screen.getByTestId('mm-spell-level')).toHaveTextContent('1');
    expect(screen.getByTestId('mm-total-missiles')).toHaveTextContent('3');
    expect(screen.getByTestId('mm-missile-damage')).toHaveTextContent('1d4+1');
    expect(screen.getByTestId('mm-creature-count')).toHaveTextContent('2');
    expect(screen.getByTestId('mm-current-target')).toHaveTextContent('Goblin');

    screen.getByTestId('mm-confirm').click();
    expect(confirmFn).toHaveBeenCalledTimes(1);
    screen.getByTestId('mm-skip').click();
    expect(skipFn).toHaveBeenCalledTimes(1);
  });
});
