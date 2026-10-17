// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import CharBonusActions from './CharBonusActions.jsx';
import { categorizeFeatures } from '../../services/character/featureCategorizationUtils.js';

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
  getInnateSorceryBonus: vi.fn(() => ({ saveDcBonus: 0 })),
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
  default: vi.fn(() => <div data-testid="metamagic-popup" />),
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: vi.fn(() => <div data-testid="spell-detail-popup" />),
}));

vi.mock('./HexAbilityModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="hex-ability-modal" />),
}));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="secondary-target-modal" />),
}));

vi.mock('./ArcaneVigorModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="arcane-vigor-modal" />),
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

vi.mock('../../hooks/combat/useSpellPositionResolver.js', () => ({
  useSpellPositionResolver: vi.fn(() => ({ resolvePositions: vi.fn(), cachedPosRef: {} })),
}));

vi.mock('../../hooks/combat/useSpellCastExecutor.js', () => ({
  useSpellCastExecutor: vi.fn(() => ({ castAction: vi.fn() })),
}));

vi.mock('../../services/ui/formatUtils.js', () => ({
  formatRange: vi.fn((range) => range || ''),
  signFormatter: { format: (n) => (n >= 0 ? `+${n}` : `${n}`) },
  getAttackSpellLevel: vi.fn(() => null),
}));

const getIllusionistFeature = (name) => {
  const classes = JSON.parse(readFileSync('public/data/2024/classes.json', 'utf8'));
  const wizard = classes.find(c => c.name === 'Wizard');
  const illusionist = wizard.majors.find(m => m.name === 'Illusionist');
  const feature = illusionist.features.find(f => f.name === name);
  return { name: feature.name, description: feature.description, automation: feature.automation };
};

const basePlayerStats = {
  name: 'IllusionWizard',
  rules: '2024',
  level: 14,
  attacks: [],
  bonusActions: [],
  spellAbilities: { spells: [] },
};

describe('CLA-179 Illusory Reality entry point', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it('categorizes the real disk-shipped Illusory Reality feature into bonusActions, not specialActions', () => {
    const feature = getIllusionistFeature('Illusory Reality');
    // Pin the canonical casting_time format the categorizer contracts on;
    // a data regression here silently reroutes the feature out of the BA lane.
    expect(feature.automation.casting_time).toBe('1 bonus action');

    const result = categorizeFeatures([feature], { actions: [], bonusActions: [], reactions: [], characterAdvancement: [] });
    expect(result.bonusActions.map(f => f.name)).toContain('Illusory Reality');
    expect(result.specialActions.map(f => f.name)).not.toContain('Illusory Reality');
  });

  it('renders the real Illusory Reality feature as a clickable row that dispatches its automation', () => {
    const feature = getIllusionistFeature('Illusory Reality');
    const categorized = categorizeFeatures([feature], { actions: [], bonusActions: [], reactions: [], characterAdvancement: [] });
    const playerStats = { ...basePlayerStats, bonusActions: categorized.bonusActions };
    const onAutomationAction = vi.fn();

    render(<CharBonusActions playerStats={playerStats} campaignName="test" onAutomationAction={onAutomationAction} />);

    const row = screen.getByText(/Illusory Reality:/);
    expect(row).toHaveClass('clickable');
    fireEvent.click(row);
    // hasAutomation is unmocked: this click also pins illusory_reality's
    // routing through the real automation registry.
    expect(onAutomationAction).toHaveBeenCalledTimes(1);
    expect(onAutomationAction).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Illusory Reality',
      automation: expect.objectContaining({ type: 'illusory_reality' }),
    }));
  });
});
