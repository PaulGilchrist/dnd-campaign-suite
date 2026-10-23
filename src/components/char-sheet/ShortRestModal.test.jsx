// @maintained-by-ai
// Base lane for ShortRestModal: initial render/state, hit-dice roll UI, class-feature
// gating/display, closing behavior, and the primary completion flow (onComplete, exact
// Sorcerous Restoration writes, CLA-011 Arcane Recovery merged batch + refusal).
// Owned elsewhere, not re-tested here: completion log lines & HP writes
// (ShortRestModal.completionFlow.test.jsx), Natural Recovery (…naturalRecovery.test.jsx),
// Celestial Resilience picker (…celestialResilience.test.jsx), Memorize Spell swap
// internals (…coverage.test.jsx — this file keeps only its render/gating).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ShortRestModal from './ShortRestModal.jsx';
import { getClassFeatures } from '../../services/character/classFeatures.js';
import { getShortRestResourceLabels } from '../../services/rules/effects/restRules.js';
import { addEntry } from '../../services/ui/logService.js';

const getRuntimeValueMock = vi.fn(() => null);
const setRuntimeValueMock = vi.fn();
const setRuntimeBatchMock = vi.fn();

// Exactly the symbols ShortRestModal (and its unmocked CreatureSelectionModal →
// spellOverlayService / tempHpService deps) import. useRuntimeValue reads the same
// fake store as getRuntimeValue, mirroring production.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (...args) => getRuntimeValueMock(...args),
  setRuntimeValue: (...args) => setRuntimeValueMock(...args),
  setRuntimeBatch: (...args) => setRuntimeBatchMock(...args),
  useRuntimeValue: (...args) => getRuntimeValueMock(...args),
}));

// Deterministic stand-ins (no real dice): every d8 rolls a 4.
vi.mock('../../services/dice/diceRoller.js', () => ({
  rollDice: vi.fn((count, _die) => ({ total: count * 4, rolls: Array(count).fill(4) })),
}));

// REAL static-data producer for labels: passthrough to restRules-constants.js
// (the canned ['Channel Divinity'] array previously here coincidentally matched a
// plain Cleric but lied for every other fixture class). Labels are plain strings
// (restRules-constants.js:41); getShortRestResourceLabels stays a spy so lanes can
// still override once. Dice/rest math/applyShortRest remain deterministic stand-ins.
vi.mock('../../services/rules/effects/restRules.js', async () => {
  const constants = await import('../../services/rules/effects/restRules-constants.js');
  return {
    getHitDieSize: vi.fn(() => 8),
    computeHitDieRecovery: vi.fn((roll, conBonus) => Math.max(1, roll + conBonus)),
    getShortRestResourceLabels: vi.fn((playerStats) => constants.getShortRestResourceLabels(playerStats)),
    applyShortRest: vi.fn(async () => ({})), // no celestialResilienceAllies → picker never opens
  };
});

// Level-5 bard/sorcerer stand-in: song d6, full sorcery pool 5.
vi.mock('../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({ songOfRestDie: 6, maxSorceryPoints: 5 })),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(() => 2),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(() => null),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpellData: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

const mockCampaignName = 'test-campaign';

function createPlayerStats(overrides = {}) {
  return {
    name: 'Thorin',
    level: 5,
    hitPoints: 45,
    proficiency: 3,
    abilities: [
      { name: 'Constitution', bonus: 2 },
      { name: 'Charisma', bonus: 3 },
    ],
    class: { name: 'Cleric', major: { name: 'Cleric' } },
    automation: { passives: [], actions: [] },
    spellAbilities: {
      spell_slots_level_1: 4,
      spell_slots_level_2: 3,
      spells: [{ name: 'Healing Word', prepared: 'Prepared' }],
    },
    inventory: { equipped: [] },
    ...overrides,
  };
}

function renderModal(overrides = {}) {
  const playerStats = createPlayerStats(overrides);
  const onClose = vi.fn();
  const onComplete = vi.fn();
  const rendered = render(
    <ShortRestModal
      playerStats={playerStats}
      campaignName={mockCampaignName}
      onClose={onClose}
      onComplete={onComplete}
    />
  );
  return { ...rendered, onClose, onComplete, playerStats };
}

function setupGetRuntimeValue(returns) {
  getRuntimeValueMock.mockImplementation((_name, key) => (key in returns ? returns[key] : null));
}

const flush = () => act(async () => {});

const rollOne = () => fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
const rollAll = () => fireEvent.click(screen.getByRole('button', { name: /Roll All/ }));
const completeRest = () => fireEvent.click(screen.getByRole('button', { name: /Complete Short Rest/ }));

function rollLogRows() {
  return document.querySelectorAll('.short-rest-roll-log tbody tr');
}

// run2#297: every write to the meal pool key, for single-owner spend counting.
function mealWrites() {
  return setRuntimeValueMock.mock.calls.filter(c => c[1] === 'replenishingMeals');
}

function recoveredTotalText() {
  return screen.getByText(/Total HP Recovered:/).closest('p').textContent;
}

const SORCERER = {
  class: { name: 'Sorcerer', major: { name: 'Sorcerer' } },
  automation: { passives: [{ type: 'resource_restoration' }] },
};

const WIZARD_ARCANE = {
  class: { name: 'Wizard', major: { name: 'Wizard' } },
  automation: { passives: [{ type: 'resource_restoration', resourceKey: 'arcaneRecoveryLevels' }] },
};

// CLA-226: automationRouter routes memorize_spell into automation.specialActions —
// fixture mirrors real router output (hand-crafted `passives` masked the bug once).
const MEMORIZE_ACTION = { type: 'memorize_spell', name: 'Memorize Spell', casting_time: 'passive', hasAutomation: true };

describe('ShortRestModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValueMock.mockImplementation(() => null);
  });

  describe('initial render', () => {
    it('renders title, roll controls, Song of Rest, and producer-restored resources', () => {
      const { onClose } = renderModal();
      expect(screen.getByRole('heading', { name: /Short Rest/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Complete Short Rest/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByText(/d8\s+—\s+5 of 5 remaining/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Roll One/ })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: /Roll All \(5\)/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Apply Song of Rest \(d6\)/ })).toBeInTheDocument();
      expect(screen.getByText('Channel Divinity').closest('li')).toBeTruthy();
      // Features the default Cleric does not own must not appear.
      expect(screen.queryByText('Bolstering Treats')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('hides the Song of Rest section when the class has no songOfRestDie', () => {
      vi.mocked(getClassFeatures).mockReturnValueOnce({});
      renderModal();
      expect(screen.queryByText('Song of Rest')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Apply Song of Rest/ })).not.toBeInTheDocument();
    });

    it('hides the Resources Restored section when the producer returns no labels', () => {
      vi.mocked(getShortRestResourceLabels).mockReturnValueOnce([]);
      renderModal();
      expect(screen.queryByText('Resources Restored')).not.toBeInTheDocument();
    });

    it('restores remaining hit dice from stored runtime state, defaulting to level', () => {
      setupGetRuntimeValue({ shortRestHitDice: 3 });
      renderModal();
      expect(screen.getByText(/3 of 5 remaining/)).toBeInTheDocument();
    });

    it('disables roll controls when no hit dice remain (no roll log before rolling)', () => {
      setupGetRuntimeValue({ shortRestHitDice: 0 });
      renderModal();
      expect(screen.getByRole('button', { name: /Roll One/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Roll All/ })).toBeDisabled();
      expect(screen.queryByText(/Total HP Recovered:/)).not.toBeInTheDocument();
    });
  });

  describe('hit dice rolling', () => {
    it.each([
      { conBonus: 2, hp: 6, why: 'CON 2 adds to every die' },
      { conBonus: 0, hp: 4, why: 'zero CON adds nothing, silently' },
    ])('Roll One logs one honest line — roll 4 + CON $conBonus = $hp ($why)', ({ conBonus, hp }) => {
      renderModal({ abilities: [{ name: 'Constitution', bonus: conBonus }, { name: 'Charisma', bonus: 3 }] });
      rollOne();
      const rows = rollLogRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].children[0].textContent).toBe('4');
      expect(rows[0].children[1].textContent).toBe(String(hp));
      expect(recoveredTotalText()).toContain(`Total HP Recovered: ${hp}`);
      expect(screen.getByText(/4 of 5 remaining/)).toBeInTheDocument();
    });

    it('Roll One twice accumulates recovery and consumes dice', () => {
      renderModal();
      rollOne();
      rollOne();
      expect(rollLogRows()).toHaveLength(2);
      expect(recoveredTotalText()).toContain('Total HP Recovered: 12');
      expect(screen.getByText(/3 of 5 remaining/)).toBeInTheDocument();
    });

    it('Roll All consumes every remaining die in one action and disables itself', () => {
      renderModal();
      rollAll();
      expect(rollLogRows()).toHaveLength(5);
      expect(recoveredTotalText()).toContain('Total HP Recovered: 30');
      expect(screen.getByText(/0 of 5 remaining/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Roll One/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Roll All/ })).toBeDisabled();
    });
  });

  describe('Song of Rest', () => {
    it('heals d6 + CON once, marks the log row, and consumes the section', async () => {
      renderModal();
      rollOne(); // 4 + CON 2 = 6
      fireEvent.click(screen.getByRole('button', { name: /Apply Song of Rest/ })); // 4 + 2 = 6
      await flush();
      expect(recoveredTotalText()).toContain('Total HP Recovered: 12');
      const songRows = document.querySelectorAll('.short-rest-song-row');
      expect(songRows).toHaveLength(1);
      expect(songRows[0]).toHaveTextContent('4 (Song of Rest)');
      // Section heading + apply button gone (the log-row marker stays as the receipt).
      expect(screen.queryByText('Song of Rest')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Apply Song of Rest/ })).not.toBeInTheDocument();
    });
  });

  describe('class feature gating', () => {
    it('offers the exact restore amount while restoration uses remain, and latches on request', () => {
      setupGetRuntimeValue({ sorcerousRestorationUses: 1 });
      renderModal(SORCERER);
      fireEvent.click(screen.getByRole('button', { name: 'Regain 2 Sorcery Points' }));
      expect(screen.getByText('Restoration requested')).toBeInTheDocument();
      expect(screen.queryByText(/Regain .* Sorcery Points/)).not.toBeInTheDocument();
    });

    it('offers nothing for a Sorcerer whose restoration uses are exhausted', () => {
      setupGetRuntimeValue({ sorcerousRestorationUses: 0 });
      renderModal(SORCERER);
      expect(screen.queryByText(/Regain .* Sorcery Points/)).not.toBeInTheDocument();
    });

    it.each([
      { uses: 0, want: true, why: 'pool below max (CHA 3)' },
      { uses: 3, want: false, why: 'already at max — nothing to regain' },
    ])('Font of Inspiration notice when $uses of 3 uses remain: visible $want ($why)', ({ uses, want }) => {
      setupGetRuntimeValue({ bardicInspirationUses: uses });
      renderModal({
        class: { name: 'Bard', major: { name: 'Bard' } },
        automation: { passives: [{ type: 'font_of_inspiration' }] },
      });
      if (want) {
        expect(screen.getByText(/Font of Inspiration applied on short rest/)).toBeInTheDocument();
        expect(screen.getByText('Regain 3 expended Bardic Inspiration uses.')).toBeInTheDocument();
      } else {
        expect(screen.queryByText(/Font of Inspiration/)).not.toBeInTheDocument();
      }
    });

    it.each([
      { levels: 2, want: true, why: 'full budget' },
      { levels: null, want: true, why: 'CLA-011: null = re-armed by the long rest' },
      { levels: 0, want: false, why: 'CLA-011: 0 = spent since last long rest' },
    ])('Arcane Recovery section when arcaneRecoveryLevels is $levels: visible $want ($why)', ({ levels, want }) => {
      setupGetRuntimeValue({ arcaneRecoveryLevels: levels });
      renderModal(WIZARD_ARCANE);
      const heading = screen.queryByText('Arcane Recovery');
      if (want) {
        expect(heading).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Recover Spell Slots/ })).toBeInTheDocument();
      } else {
        expect(heading).not.toBeInTheDocument();
      }
    });

    it('renders the Memorize Spell swap entry from specialActions (CLA-226 bucket)', async () => {
      renderModal({
        class: { name: 'Wizard', major: { name: 'Wizard' } },
        automation: { specialActions: [MEMORIZE_ACTION] },
      });
      await flush(); // loadSpellData effect
      expect(screen.getByText('Memorize Spell')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Swap Prepared Spell/ })).toBeInTheDocument();
    });

    it('does NOT render Memorize Spell from a passives-bucket entry (CLA-226 gate guard)', () => {
      renderModal({
        class: { name: 'Wizard', major: { name: 'Wizard' } },
        automation: { passives: [MEMORIZE_ACTION] },
      });
      expect(screen.queryByText('Memorize Spell')).not.toBeInTheDocument();
    });

    it('crafts Bolstering Treats once, stamping proficiency count to the runtime', () => {
      renderModal({ automation: { passives: [{ type: 'temp_hp_buff', name: 'Bolstering Treats' }] } });
      expect(screen.getByText(/Craft 3 bolstering treats/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Craft Bolstering Treats/ }));
      expect(screen.getByText('Treats crafted')).toBeInTheDocument();
      expect(setRuntimeValueMock).toHaveBeenCalledTimes(1);
      expect(setRuntimeValueMock).toHaveBeenCalledWith('Thorin', 'chefBolsteringTreats', 3, mockCampaignName);
    });

    it('consumes a Replenishing Meal on the next hit die roll, spending only at completion', async () => {
      setupGetRuntimeValue({ replenishingMeals: 2 });
      renderModal({
        automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' }] },
      });
      expect(screen.getByText('Replenishing Meal')).toBeInTheDocument();
      rollOne();
      // 4 + CON 2 + meal 1d8 (4) = 10 on the roll line; meal consumed.
      expect(rollLogRows()[0].children[1].textContent).toBe('10');
      expect(screen.getByText(/Replenishing Meal consumed/)).toBeInTheDocument();
      // run2#297 single spend owner: rolls stage locally — ZERO decrements at roll time
      // (the old roll-time write double-spent when handleComplete re-read and subtracted).
      expect(mealWrites()).toHaveLength(0);
      completeRest();
      await flush();
      // Exactly one spend at the end-of-rest chokepoint: fresh read 2 → 1.
      expect(mealWrites()).toEqual([['Thorin', 'replenishingMeals', 1, mockCampaignName]]);
    });

    it('cancel after consuming a meal spends nothing — staged rolls never committed a meal', () => {
      setupGetRuntimeValue({ replenishingMeals: 3 });
      const { onClose } = renderModal({
        automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' }] },
      });
      rollOne();
      expect(screen.getByText(/Replenishing Meal consumed/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
      // Pre-fix this lane burned 3→2 at roll time with no rollback on Cancel.
      expect(mealWrites()).toHaveLength(0);
      expect(setRuntimeValueMock).not.toHaveBeenCalled();
    });
  });

  describe('completion', () => {
    it('completes once via onComplete (never onClose) and honestly logs a zero-dice rest', async () => {
      const { onClose, onComplete } = renderModal();
      completeRest();
      await flush();
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
      const restLogs = vi.mocked(addEntry).mock.calls.map(c => c[1]).filter(e => e && e.type === 'short_rest');
      expect(restLogs).toHaveLength(1);
      expect(restLogs[0].message).toContain('Thorin takes a short rest.');
      expect(restLogs[0].message).toContain('Hit Dice: 0 used');
      // FIXED (was ShortRestModal.jsx:175-179 dead branch): getShortRestResourceLabels
      // returns strings (restRules-constants.js:41); collectRestoredResources now consumes
      // them directly, so the producer's 'Channel Divinity' reaches this log line.
      expect(restLogs[0].message).toContain('Resources restored: Channel Divinity');
    });

    it('writes the exact sorcery pool and consumes the use on completion', async () => {
      setupGetRuntimeValue({ sorceryPoints: 3, sorcerousRestorationUses: 1 });
      renderModal(SORCERER);
      fireEvent.click(screen.getByRole('button', { name: 'Regain 2 Sorcery Points' }));
      completeRest();
      await flush();
      // maxSorceryPoints 5, restore 2 → min(5, 3+2) = 5; restorationUses: 0 = spent.
      expect(setRuntimeValueMock.mock.calls.filter(c => c[1] === 'sorceryPoints')).toHaveLength(1);
      expect(setRuntimeValueMock).toHaveBeenCalledWith('Thorin', 'sorceryPoints', 5, mockCampaignName);
      expect(setRuntimeValueMock).toHaveBeenCalledWith('Thorin', 'sorcerousRestorationUses', 0, mockCampaignName);
    });

    it('CLA-011: recovers slots and consumes the budget in ONE merged batch write', async () => {
      setupGetRuntimeValue({ arcaneRecoveryLevels: 3, spell_slots_level_1: 2 });
      renderModal(WIZARD_ARCANE);
      fireEvent.click(screen.getByRole('button', { name: /Recover Spell Slots/ }));
      completeRest();
      await flush();
      // lv1: 4 max − 2 current = 2 recovered; lv2+ full; budget ceil(5/2) = 3 levels.
      expect(setRuntimeBatchMock).toHaveBeenCalledTimes(1);
      expect(setRuntimeBatchMock).toHaveBeenCalledWith(
        'Thorin',
        { spell_slots_level_1: 4, arcaneRecoveryLevels: 0 },
        mockCampaignName
      );
      // No per-key slot writes outside the merged batch (§39 same-tick overwrite).
      expect(setRuntimeValueMock.mock.calls.filter(c => c[1] === 'spell_slots_level_1')).toHaveLength(0);
    });

    it('CLA-011: logs arcane_recovery_refused with zero slot writes when the budget is spent', async () => {
      setupGetRuntimeValue({ arcaneRecoveryLevels: 0 });
      renderModal(WIZARD_ARCANE);
      completeRest();
      await flush();
      const refusals = vi.mocked(addEntry).mock.calls.filter(c => c[1] && c[1].automationType === 'arcane_recovery_refused');
      expect(refusals).toHaveLength(1);
      expect(refusals[0][0]).toBe(mockCampaignName);
      expect(refusals[0][1]).toMatchObject({ type: 'automation', characterName: 'Thorin' });
      expect(setRuntimeBatchMock.mock.calls.filter(c => c[1] && 'spell_slots_level_1' in c[1])).toHaveLength(0);
    });
  });

  describe('closing', () => {
    it('closes via Cancel button and Escape key', () => {
      const { onClose } = renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('ignores backdrop and modal-body clicks (no accidental close)', () => {
      const { onClose } = renderModal();
      fireEvent.click(document.querySelector('.short-rest-overlay'));
      fireEvent.click(document.querySelector('.short-rest-modal'));
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('heading', { name: /Short Rest/ })).toBeInTheDocument();
    });
  });
});
