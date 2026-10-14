// @improved-by-ai
/**
 * CharSpells — Restoration spell popups (Greater Restoration / Lesser Restoration).
 *
 * Covers the two-step restoration flow CharSpells wires through TargetSpellPopups:
 * target picker → live detection of removable effects/conditions from the runtime
 * store and combat summary → confirm payload, skip, and no-effects paths.
 *
 * SecondaryTargetModal is stubbed with a faithful minimal contract (radio row
 * selects, confirm button dispatches `onTargetSelected(selected)`, Skip closes)
 * so tests exercise real user behavior via accessible roles without reaching
 * into modal internals (map distance badges, styling). Other CharSpells
 * behaviors are covered by the sibling CharSpells.*.test.jsx files.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockPlayerStats } from './CharSpells.test-utils.js';
import CharSpells from './CharSpells.jsx';

// Flow hook return values are plain closures over these per-test stubs, so no
// resetAllMocks games are needed to keep them stable across tests.
let flow;
let upcastFlow;

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: () => [],
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: () => {},
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  default: () => ({}),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: () => ({ rollAttack: vi.fn(), rollDamage: vi.fn(), quickRollPlayerSave: vi.fn() }),
}));

vi.mock('../../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: () => ({ setPopupHtml: vi.fn() }),
}));

vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: () => flow,
}));

vi.mock('../../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: () => upcastFlow,
}));

vi.mock('../../../hooks/combat/useSpellCastExecutor.js', () => ({
  useSpellCastExecutor: () => ({ castAction: vi.fn() }),
}));

vi.mock('../../../hooks/combat/useSpellPositionResolver.js', () => ({
  useSpellPositionResolver: () => ({
    resolvePositions: () => Promise.resolve(),
    cachedPosRef: { current: null },
  }),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: () => Promise.resolve(null),
  getTargetFromAttacker: () => null,
  getAttackerTargetName: () => null,
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => Promise.resolve({ creatures: [] })),
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
  loadMapData: () => Promise.resolve({ players: [], placedItems: [] }),
}));

vi.mock('../../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: () => null,
}));

vi.mock('../../../services/ui/dataLoader.js', () => ({
  loadMonsters: () => Promise.resolve([]),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: () => false,
}));

vi.mock('../../../services/automation/handlers/spells/shapechangeService.js', () => ({
  confirmShapechangeTransform: () => Promise.resolve(),
}));

vi.mock('../../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: () => Promise.resolve(),
  isFreeCastAuthorized: () => false,
  isWizardRitualAdeptSpell: () => false,
}));

vi.mock('../useAttackDamageResolution.js', () => ({
  normalizeAutoDamage: vi.fn(),
  resolveAttackDamageStandalone: () => Promise.resolve(),
}));

// Sub-components unrelated to the restoration stage — inert so they can neither
// fail nor pollute the queries these tests make.
vi.mock('./CharSpellSlots.jsx', () => ({ default: () => null }));
vi.mock('./SpellDetailPopup.jsx', () => ({ default: () => null }));
vi.mock('./UpcastPopup.jsx', () => ({ default: () => null }));
vi.mock('../popups/MetamagicPopup.jsx', () => ({ default: () => null }));
vi.mock('../popups/MultiTargetPopup.jsx', () => ({ default: () => null }));
vi.mock('../popups/MagicMissileTargetPopup.jsx', () => ({ default: () => null }));

// Faithful minimal stub of SecondaryTargetModal: mirrors the real modal's user
// contract — radio rows select, the confirm button dispatches the selection
// (label via `value` for option targets, `name` for creature targets), and
// `hideConfirm` with no targets suppresses the confirm button.
vi.mock('../modals/shared/SecondaryTargetModal.jsx', async () => {
  const { useState } = await import('react');
  return {
    default: function SecondaryTargetModalStub({ title, targets, onTargetSelected, onSkip, description, confirmLabel, hideConfirm }) {
      const [selected, setSelected] = useState(null);
      const keyOf = (t) => ('value' in t ? t.value : t.name);
      return (
        <div role="dialog" aria-label={title}>
          {description && <p dangerouslySetInnerHTML={{ __html: description }} />}
          {targets.map((t) => (
            <label key={keyOf(t)}>
              <input
                type="radio"
                name="secondary-target-option"
                checked={selected === keyOf(t)}
                onChange={() => setSelected(keyOf(t))}
              />
              {'value' in t ? t.label : t.name}
            </label>
          ))}
          {(!hideConfirm || targets.length > 0) && (
            <button type="button" disabled={!selected || targets.length === 0} onClick={() => onTargetSelected?.(selected)}>
              {confirmLabel || 'Attack'}
            </button>
          )}
          <button type="button" onClick={() => onSkip?.()}>Skip</button>
        </div>
      );
    },
  };
});

import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';

// ── Per-test fixtures / helpers ───────────────────────────────────────────

const CAMPAIGN = 'test-campaign';

// Every popup in CharSpells is guarded by its own `pending*` truthiness check,
// so only the restoration fields (plus the metamagic gate) need to exist here.
function createRestorationFlowStub() {
  return {
    gateMetamagic: vi.fn(),
    pendingGreaterRestoration: null,
    handleGreaterRestorationConfirm: vi.fn(),
    handleGreaterRestorationSkip: vi.fn(),
    handleGreaterRestorationNoEffects: vi.fn(),
    pendingLesserRestoration: null,
    handleLesserRestorationConfirm: vi.fn(),
    handleLesserRestorationSkip: vi.fn(),
  };
}

function castGreaterRestoration(creatureTargets = ['Orc'], range = '60 feet') {
  flow.pendingGreaterRestoration = { creatureTargets, range };
}

function castLesserRestoration(creatureTargets = ['Orc'], range = '30 feet') {
  flow.pendingLesserRestoration = { creatureTargets, range };
}

/** What the runtime store reports for the targeted creature during effect detection. */
function targetRuntimeState(state = {}) {
  vi.mocked(getRuntimeValue).mockImplementation((name, key) => state[key] ?? null);
}

/** Combat summary reporting the given condition keys against the target creature. */
function combatSummaryConditions(targetName, ...conditionKeys) {
  vi.mocked(getCombatSummary).mockResolvedValue({
    creatures: [{ name: targetName, conditions: conditionKeys.map((key) => ({ key })) }],
  });
}

function renderCharSpells() {
  return render(<CharSpells playerStats={mockPlayerStats} campaignName={CAMPAIGN} />);
}

/** Real modal contract: pick a radio row, then press the stage's confirm button. */
function choose(optionName, confirmLabel) {
  fireEvent.click(screen.getByRole('radio', { name: optionName }));
  fireEvent.click(screen.getByRole('button', { name: confirmLabel }));
}

function clickSkip() {
  fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
}

describe('CharSpells - Restoration Spells', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    flow = createRestorationFlowStub();
    upcastFlow = {
      pendingUpcast: null,
      buildUpcastLevels: () => [],
      handleUpcastConfirm: vi.fn(),
      handleUpcastCancel: vi.fn(),
    };
    targetRuntimeState();
    vi.mocked(getCombatSummary).mockResolvedValue({ creatures: [] });
  });

  describe('Greater Restoration', () => {
    it('asks for a target, listing creatures in range with confirm disabled until one is picked', () => {
      castGreaterRestoration(['Orc', 'Goblin']);
      renderCharSpells();

      expect(screen.getByRole('dialog', { name: 'Greater Restoration' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Orc' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Goblin' })).toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Greater Restoration' })).toHaveTextContent(/within 60 feet/i);
      expect(screen.getByRole('button', { name: 'Cast Greater Restoration' })).toBeDisabled();
      expect(flow.handleGreaterRestorationConfirm).not.toHaveBeenCalled();
    });

    it('lists every removable effect detected on the chosen target', async () => {
      castGreaterRestoration();
      targetRuntimeState({
        activeConditions: ['Charmed'],
        exhaustionLevel: 2,
        activeBuffs: [{ type: 'cursed', name: 'Armor of Invulnerability' }],
        abilityReductions: { str: 1 },
        hpMaxReduction: 5,
      });
      renderCharSpells();

      choose('Orc', 'Cast Greater Restoration');

      await waitFor(() => expect(screen.getByRole('radio', { name: 'Charmed condition' })).toBeInTheDocument());
      expect(screen.getByRole('radio', { name: 'Exhaustion level (current: 2)' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Curse (including attunement to cursed magic item)' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Ability score reduction' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Hit Point maximum reduction' })).toBeInTheDocument();
    });

    it('confirms the chosen condition effect with its target', async () => {
      castGreaterRestoration();
      targetRuntimeState({ activeConditions: ['Charmed'] });
      renderCharSpells();

      choose('Orc', 'Cast Greater Restoration');
      await waitFor(() => expect(screen.getByRole('radio', { name: 'Charmed condition' })).toBeInTheDocument());
      choose('Charmed condition', 'Remove Effect');

      expect(flow.handleGreaterRestorationConfirm).toHaveBeenCalledWith({
        targetName: 'Orc',
        selections: [{ type: 'condition', condition: 'charmed' }],
      });
    });

    it('confirms exhaustion removal with a plain effect selection', async () => {
      castGreaterRestoration();
      targetRuntimeState({ exhaustionLevel: 3 });
      renderCharSpells();

      choose('Orc', 'Cast Greater Restoration');
      await waitFor(() => expect(screen.getByRole('radio', { name: 'Exhaustion level (current: 3)' })).toBeInTheDocument());
      choose('Exhaustion level (current: 3)', 'Remove Effect');

      expect(flow.handleGreaterRestorationConfirm).toHaveBeenCalledWith({
        targetName: 'Orc',
        selections: [{ type: 'exhaustion' }],
      });
    });

    it('merges conditions from the runtime store and combat summary without duplicates', async () => {
      castGreaterRestoration();
      targetRuntimeState({ activeConditions: ['CHARMED', 'petrified'] });
      combatSummaryConditions('Orc', 'charmed');
      renderCharSpells();

      choose('Orc', 'Cast Greater Restoration');

      await waitFor(() => expect(screen.getAllByRole('radio', { name: 'Charmed condition' })).toHaveLength(1));
      expect(screen.getByRole('radio', { name: 'Petrified condition' })).toBeInTheDocument();
    });

    it('detects a curse from buff entries flagged by type or cursed property, listed once', async () => {
      castGreaterRestoration();
      targetRuntimeState({ activeBuffs: [{ type: 'cursed' }, { cursed: true }] });
      renderCharSpells();

      choose('Orc', 'Cast Greater Restoration');

      await waitFor(() => expect(screen.getAllByRole('radio', { name: /^Curse/ })).toHaveLength(1));
    });

    it('cancels the cast when skipped at the target step', () => {
      castGreaterRestoration();
      renderCharSpells();

      clickSkip();

      expect(flow.handleGreaterRestorationSkip).toHaveBeenCalledTimes(1);
      expect(flow.handleGreaterRestorationConfirm).not.toHaveBeenCalled();
    });

    it('returns to the target step when skipped at the effect step, without casting', async () => {
      castGreaterRestoration();
      targetRuntimeState({ activeConditions: ['Charmed'] });
      renderCharSpells();

      choose('Orc', 'Cast Greater Restoration');
      await waitFor(() => expect(screen.getByRole('radio', { name: 'Charmed condition' })).toBeInTheDocument());
      clickSkip();

      expect(screen.getByRole('radio', { name: 'Orc' })).toBeInTheDocument();
      expect(screen.queryByRole('radio', { name: 'Charmed condition' })).not.toBeInTheDocument();
      expect(flow.handleGreaterRestorationConfirm).not.toHaveBeenCalled();
    });

    it('reports no removable effects and routes dismissal to the no-effects handler', async () => {
      castGreaterRestoration();
      renderCharSpells();

      choose('Orc', 'Cast Greater Restoration');

      await waitFor(() => expect(screen.getByText(/No removable effects found on Orc/i)).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: 'Remove Effect' })).not.toBeInTheDocument();

      clickSkip();

      expect(flow.handleGreaterRestorationNoEffects).toHaveBeenCalledTimes(1);
    });
  });

  describe('Lesser Restoration', () => {
    it('asks for a target, listing creatures in range with confirm disabled until one is picked', () => {
      castLesserRestoration(['Orc', 'Goblin']);
      renderCharSpells();

      expect(screen.getByRole('dialog', { name: 'Lesser Restoration' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Orc' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Goblin' })).toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Lesser Restoration' })).toHaveTextContent(/within 30 feet/i);
      expect(screen.getByRole('button', { name: 'Cast Lesser Restoration' })).toBeDisabled();
      expect(flow.handleLesserRestorationConfirm).not.toHaveBeenCalled();
    });

    it('offers only the four removable conditions, deduplicated across runtime and combat summary', async () => {
      castLesserRestoration();
      targetRuntimeState({ activeConditions: ['Blinded', 'DEAFENED', 'Charmed', 'Petrified'] });
      combatSummaryConditions('Orc', 'blinded', 'poisoned');
      renderCharSpells();

      choose('Orc', 'Cast Lesser Restoration');

      await waitFor(() => expect(screen.getAllByRole('radio', { name: 'Blinded condition' })).toHaveLength(1));
      expect(screen.getAllByRole('radio', { name: 'Deafened condition' })).toHaveLength(1);
      expect(screen.getByRole('radio', { name: 'Poisoned condition' })).toBeInTheDocument();
      expect(screen.queryByRole('radio', { name: 'Charmed condition' })).not.toBeInTheDocument();
      expect(screen.queryByRole('radio', { name: 'Petrified condition' })).not.toBeInTheDocument();
    });

    it('confirms the chosen condition on the chosen target', async () => {
      castLesserRestoration();
      targetRuntimeState({ activeConditions: ['Blinded'] });
      renderCharSpells();

      choose('Orc', 'Cast Lesser Restoration');
      await waitFor(() => expect(screen.getByRole('radio', { name: 'Blinded condition' })).toBeInTheDocument());
      choose('Blinded condition', 'Remove Condition');

      expect(flow.handleLesserRestorationConfirm).toHaveBeenCalledWith({ targetName: 'Orc', condition: 'blinded' });
    });

    it('cancels the cast when skipped at the target step', () => {
      castLesserRestoration();
      renderCharSpells();

      clickSkip();

      expect(flow.handleLesserRestorationSkip).toHaveBeenCalledTimes(1);
      expect(flow.handleLesserRestorationConfirm).not.toHaveBeenCalled();
    });

    it('returns to the target step when skipped at the condition step, without casting', async () => {
      castLesserRestoration();
      targetRuntimeState({ activeConditions: ['Blinded'] });
      renderCharSpells();

      choose('Orc', 'Cast Lesser Restoration');
      await waitFor(() => expect(screen.getByRole('radio', { name: 'Blinded condition' })).toBeInTheDocument());
      clickSkip();

      expect(screen.getByRole('radio', { name: 'Orc' })).toBeInTheDocument();
      expect(screen.queryByRole('radio', { name: 'Blinded condition' })).not.toBeInTheDocument();
      expect(flow.handleLesserRestorationConfirm).not.toHaveBeenCalled();
    });

    it('reports no removable conditions and routes dismissal to the skip handler', async () => {
      castLesserRestoration();
      renderCharSpells();

      choose('Orc', 'Cast Lesser Restoration');

      await waitFor(() => expect(screen.getByText(/No removable conditions found on Orc/i)).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: 'Remove Condition' })).not.toBeInTheDocument();

      clickSkip();

      expect(flow.handleLesserRestorationSkip).toHaveBeenCalledTimes(1);
    });

    it('still offers runtime conditions when the combat summary lookup fails', async () => {
      castLesserRestoration();
      targetRuntimeState({ activeConditions: ['Poisoned'] });
      vi.mocked(getCombatSummary).mockRejectedValue(new Error('combat summary unavailable'));
      renderCharSpells();

      choose('Orc', 'Cast Lesser Restoration');
      await waitFor(() => expect(screen.getByRole('radio', { name: 'Poisoned condition' })).toBeInTheDocument());
      choose('Poisoned condition', 'Remove Condition');

      expect(flow.handleLesserRestorationConfirm).toHaveBeenCalledWith({ targetName: 'Orc', condition: 'poisoned' });
    });
  });
});
