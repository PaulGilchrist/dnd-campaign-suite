// @maintained-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CharBonusActions from './CharBonusActions.jsx';

vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    pendingAid: null,
    handleAidConfirm: vi.fn(),
    handleAidSkip: vi.fn(),
    pendingGreaterRestoration: null,
    handleGreaterRestorationConfirm: vi.fn(),
    handleGreaterRestorationSkip: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    buildUpcastLevels: vi.fn(() => []),
  })),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/automation/handlers/combat/saveAttackHandler.js', () => ({
  isExhausted: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
  triggerPostCastRiderSaves: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/combat/useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 10),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
}));

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn((_playerName, _campaignName) => ({ saveDcBonus: 0 })),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  useRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  showWeaponMasteryPopup: vi.fn(),
  buildFeatureDetailHtml: vi.fn(() => null),
}));

vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: vi.fn((_props) => <div data-testid="metamagic-popup">{_props.spell?.name || 'MetamagicPopup'}</div>),
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: vi.fn((_props) => <div data-testid="spell-detail-popup">SpellDetailPopup</div>),
}));

vi.mock('./HexAbilityModal.jsx', () => ({
  default: vi.fn((props) => <div data-testid="hex-ability-modal"><button onClick={props.onCancel}>Cancel</button></div>),
}));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: vi.fn((_props) => <div data-testid="secondary-target-modal">{_props.title}</div>),
}));

vi.mock('./ArcaneVigorModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="arcane-vigor-modal">Arcane Vigor</div>),
}));

vi.mock('../../services/rules/core/spellDamageUtils.js', () => ({
  resolveSpellDamageAtLevel: vi.fn(() => null),
  isAutoHitSpell: vi.fn(() => false),
  resolveHealExpression: vi.fn(() => ''),
}));

vi.mock('../../services/ui/spellSectionUtils.js', () => ({
  getBonusActionSpellNames: vi.fn(() => new Set()),
}));

vi.mock('../../services/character/featureCategories.js', () => ({
  getCategories: vi.fn(() => ({ featuresToIgnore: [] })),
}));

vi.mock('../../hooks/combat/useSimpleDamageRoll.js', () => ({
  useSimpleDamageRoll: vi.fn(() => vi.fn()),
}));

vi.mock('../../hooks/combat/useSpellPositionResolver.js', () => ({
  useSpellPositionResolver: vi.fn(() => ({ resolvePositions: vi.fn(), cachedPosRef: {} })),
}));

vi.mock('../../hooks/combat/useSpellCastExecutor.js', () => ({
  useSpellCastExecutor: vi.fn(() => ({ castAction: vi.fn() })),
}));

vi.mock('../../services/ui/formatUtils.js', () => ({
  formatRange: vi.fn((range) => {
    if (!range && range !== 0) return '';
    return `${range} ft.`;
  }),
  signFormatter: { format: (n) => (n >= 0 ? `+${n}` : `${n}`) },
  getAttackSpellLevel: vi.fn(() => null),
}));

// SP-129: buildSwiftQuiverAttack rows must carry BOTH type and actionType.
// The BA lane filter (CharBonusActions.jsx) keys off attack.type ONLY —
// a row with actionType but no type is silently dropped from the lane.
// Producer contract (both fields, two rows) is pinned in
// attackCalc2024-special-attacks.test.js; generic single-row lane rendering
// and the hit-cell click lane are pinned in CharBonusActions.rendering /
// .interactive tests. This file pins the Swift Quiver consumer half:
// both full-shape rows render together, and type is the hard requirement.
describe('CharBonusActions - Swift Quiver rows', () => {
  const swiftQuiverRow = (overrides = {}) => ({
    name: 'Swift Quiver (1st Attack)',
    attackType: 'ranged',
    isRanged: true,
    range: 600,
    toHit: 9,
    hitBonus: 9,
    damageFormula: 'Damage Formula = 1d8 + Dexterity Modifier (5)',
    damage: '1d8+5',
    damageType: 'Piercing',
    abilityName: 'Dexterity',
    type: 'Bonus Action',
    actionType: 'Bonus Action',
    properties: ['Ammunition'],
    isSwiftQuiver: true,
    ...overrides,
  });

  const basePlayerStats = {
    name: 'FeyRanger',
    rules: '2024',
    level: 17,
    attacks: [],
    bonusActions: [],
    spellAbilities: { spells: [] },
  };

  const renderLane = (attacks, props = {}) => render(
    <CharBonusActions
      playerStats={{ ...basePlayerStats, attacks }}
      getWeaponMastery={() => null}
      {...props}
    />
  );

  it('renders both Swift Quiver rows as live attack cells in the bonus action lane', () => {
    renderLane(
      [swiftQuiverRow(), swiftQuiverRow({ name: 'Swift Quiver (2nd Attack)' })],
      { exhaustionPenalty: 0 }
    );

    expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    expect(screen.getByText('Swift Quiver (1st Attack)')).toBeInTheDocument();
    expect(screen.getByText('Swift Quiver (2nd Attack)')).toBeInTheDocument();
    // Each row renders a real attack cell (to-hit, range, damage) — not just a label.
    expect(screen.getAllByText('+9')).toHaveLength(2);
    expect(screen.getAllByText('600 ft.')).toHaveLength(2);
    expect(screen.getAllByText('1d8+5')).toHaveLength(2);
  });

  it('drops rows entirely when type is missing even though actionType is "Bonus Action" (SP-129 filter pin)', () => {
    const { container } = renderLane([
      swiftQuiverRow({ type: undefined }),
      swiftQuiverRow({ name: 'Swift Quiver (2nd Attack)', type: undefined }),
    ]);

    expect(screen.queryByText('Swift Quiver (1st Attack)')).not.toBeInTheDocument();
    expect(screen.queryByText('Swift Quiver (2nd Attack)')).not.toBeInTheDocument();
    expect(container.querySelector('.sectionHeader')).toBeNull();
  });
});
