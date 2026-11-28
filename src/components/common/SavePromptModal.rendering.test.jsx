// @maintained-by-ai 2026-11-27 — rendering lane: full-sentence copy toBe pins vs current source, testid flushes, mock keys mirrored to #1935-#1944, phantoms purged, roster-shape it.each dropped (zero rendering discriminating power)
// SavePromptModal — rendering (panel display face).
// Static prompt-copy contract, complete sentences pinned byte-exact against
// the CURRENT SavePromptModal.jsx: overlay/dialog visibility, the header copy,
// the target/ability/DC sentence (advantage & disadvantage badges folded into
// the same sentence bytes), the damage-outcome note rows (half / none
// positives — MA-0367's own 'full' row and its half/none leak-guards are
// .infernal-wound's), the dual-formula MA-0427 row, and source attribution —
// including negative paths (what must NOT render).
//
// Queue-counter census note (for the future unit-census owner):
// promptQueueCounterText has NO dedicated unit test file; its faces are
// modal-mount-pinned ELSEWHERE with full-string header toBe —
// .resolved-header.test.jsx ('Saving Throw Required (1 of 2)',
// 'Saving Throw (1 remaining)', and the no-counter face) plus
// DeathSavePromptModal.test.jsx for the shared function. This lane never
// mounts a multi-prompt queue, so it pins ONLY the null face (a single armed
// prompt renders no .sp-queue-info node) — not re-added here.
//
// Owned ELSEWHERE — do not re-add here:
// - Done payloads, hold-until-Done, rolled Next Save advancement, Apply(0)
//   presentation gate ................................. .actions.test.jsx (#1935)
// - 5e Dodge DEX-vs-CON arithmetic, CLA-324 against_spell + lastAttack,
//   bane/bless/warding-bond bonus-string arithmetic .... .bonuses.test.jsx (#1936)
// - saveConditions / mod.condition legs ............... .cla034-conditional-save-advantage.test.jsx (#1937)
// - CLA-211 evasion trigger gate/stamp/skip/Apply ..... .cla211-leading-evasion.test.jsx (#1938)
// - chooser row tick UX, overlay inertness, confirm-closes-leaves-PENDING,
//   clear/dismiss advancement ......................... .coverage.test.jsx (#1939)
// - 2024 Dodge ruleset gate (BA-001) .................. .dodge-2024.test.jsx (#1940)
// - Beacon WIS gate, Cosmic Omen consume, charmed/Otto DEX disadvantage .... .evasion-effects.test.jsx (#1941)
// - holy_aura te grant + ALL-saves contrast ........... .holy-aura.test.jsx (#1942)
// - Reroll-button availability matrix / once-per-save gate / cap ladder
//   .................................................. .indomitable.test.jsx (#1943)
// - MA-0367 'full'-row note copy + reroll cancel seam . .infernal-wound.test.jsx (#1944)
// - Evasion-note branches (shared/own/incapacitated,
//   cross-prompt stamp inertness) ..................... .evasion-note-selection.test.jsx
// - Roll math / result-panel breakdown strings ........ .rolling / .bonuses / .rerolls

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import SavePromptModal from './SavePromptModal.jsx';

// ── Mocks ──

vi.mock('../../services/ui/utils.js', () => ({
  default: { getName: (name) => name || 'Unknown' },
}));

// importOriginal spread per #1943/#1944: automationExpressions.js pulls
// canRollExpression/rollExpressionMaximized from this module through
// automationService (a real SavePromptModal import) — a bare two-key factory
// risks crashing that graph.
vi.mock('../../services/dice/diceRoller.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, rollD20: vi.fn(), rollExpression: vi.fn() };
});

// sendSavePrompt is a real graph import (savePrompt.js → this module); it must
// exist on the mock even though this lane never sends (#1935-#1944 pattern).
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
  sendSaveResult: vi.fn(),
  clearSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

// Flat +3 save bonus for the graph's pre-roll read; this lane never shows the
// pre-roll line (owned by .pre-roll-bonus/.live-breakdown), so it is never
// overridden here and needs no beforeEach re-baseline.
vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 3),
}));

// Graph keys mirrored to the ten sibling lanes (#1935-#1944): no
// useSyncedState/listeners phantoms — this modal never imports them.
// deleteRuntimeKey/setRuntimeObject/getAllStoreKeys/getStore back real graph
// imports (savePrompt.js, applyDamage.js, expirationQueue.js).
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  getStore: vi.fn(() => new Map()),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  deleteRuntimeKey: vi.fn(),
  setRuntimeObject: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/storage.js', () => ({
  default: { set: vi.fn(), get: vi.fn(() => null) },
}));

vi.mock('../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => []),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isCircleOfPowerActive: vi.fn(() => false) };
});

// Test-event feeder: each button dispatches one SSE-shaped event through the
// real handleEvent the modal passes down (campaign-scoped keys, as production
// Subscriber delivers them). Target names deliberately avoid any of the
// copy words under test, so negative text assertions can never match a name.
vi.mock('./Subscriber.jsx', () => {
  const promptEvent = (handleEvent, testId, campaign, data) =>
    React.createElement('button', {
      'data-testid': testId,
      onClick: () => handleEvent({ key: `change-${campaign}-savePrompt-${data.targetName}`, data }),
    });
  function MockSubscriber({ handleEvent, campaignName }) {
    return React.createElement('div', { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      promptEvent(handleEvent, 'subscriber-trigger', campaignName, {
        promptId: 'test-prompt-1', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false,
      }),
      promptEvent(handleEvent, 'subscriber-trigger-disadvantage', campaignName, {
        promptId: 'test-prompt-disadv', targetName: 'testTarget3', saveType: 'str', saveDc: 14,
        disadvantage: true, dcSuccess: 'half', sourceName: 'Fireball',
      }),
      promptEvent(handleEvent, 'subscriber-trigger-advantage', campaignName, {
        promptId: 'test-prompt-adv', targetName: 'testTarget5', saveType: 'cha', saveDc: 13,
        advantage: true, dcSuccess: 'half',
      }),
      promptEvent(handleEvent, 'subscriber-trigger-dex', campaignName, {
        promptId: 'test-prompt-dex', targetName: 'testTarget', saveType: 'dex', saveDc: 17,
        disadvantage: false, dcSuccess: 'half', sourceName: 'Sacred Flame',
      }),
      promptEvent(handleEvent, 'subscriber-trigger-none-dc', campaignName, {
        promptId: 'test-prompt-none', targetName: 'testTarget4', saveType: 'wis', saveDc: 16,
        disadvantage: false, dcSuccess: 'none',
      }),
      promptEvent(handleEvent, 'subscriber-trigger-dual-damage', campaignName, {
        promptId: 'test-prompt-dual', targetName: 'testTarget6', saveType: 'dex', saveDc: 18,
        disadvantage: false, dcSuccess: 'half', sourceName: 'Smelting Charge',
        damageFormula: '2d8', damageType: 'Piercing',
        secondaryFormula: '3d8', secondaryDamageType: 'Fire',
      }),
    );
  }
  return { default: MockSubscriber };
});

// ── Re-import mocked modules ──

import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { setupDefaults, cleanupDefaults } from './SavePromptModal.test-utils.jsx';

// ── Helpers ──

function renderModal(props = {}) {
  return render(
    <SavePromptModal campaignName="test-campaign" characters={[]} activeMapName={null} {...props} />
  );
}

// The click queues the prompt through the real handleEvent synchronously
// (fireEvent is act-wrapped); the active-prompt testid flushes without any
// copy-regex wait.
async function openPrompt(testId = 'subscriber-trigger') {
  fireEvent.click(screen.getByTestId(testId));
  return within(await screen.findByTestId('active-save-prompt'));
}

// getByText's default matcher only reads an element's OWN text nodes, but the
// prompt sentence is split across <strong> pairs — match the <p>'s complete
// normalized textContent so the full sentence (badges and spacing included)
// is pinned byte-exact, not a regex fragment.
const sentence = (text) => (_content, node) =>
  node?.tagName === 'P' && node.textContent.replace(/\s+/g, ' ').trim() === text;

describe('SavePromptModal — rendering', () => {
  beforeEach(() => {
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
  });
  afterEach(cleanupDefaults);

  // ── Overlay visibility ──

  it('renders nothing but the event subscriber while no save prompt is queued', () => {
    renderModal();

    // Subscriber stays wired (so a queued prompt can appear), but the dialog
    // itself must be absent until an event opens it.
    expect(screen.getByTestId('subscriber')).toBeInTheDocument();
    expect(screen.queryByTestId('active-save-prompt')).not.toBeInTheDocument();
    expect(document.querySelector('.sp-overlay')).not.toBeInTheDocument();
    expect(screen.queryByText('Saving Throw Required')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Roll Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  // ── Prompt display content ──

  it('displays the modal with target name, ability, and DC when a prompt is queued', async () => {
    renderModal();
    const modal = await openPrompt();

    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(modal.getByText('Saving Throw Required')).toBeInTheDocument();
    expect(modal.getByText(sentence('testTarget must make a CON saving throw.'))).toBeInTheDocument();
    expect(modal.getByText('DC 12')).toBeInTheDocument();
    expect(modal.getByRole('button', { name: 'Roll Save' })).toBeInTheDocument();
    expect(modal.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();

    // Plain prompt (no flags, no dcSuccess, no sourceName): no badges, no
    // queue counter (the single-prompt null face of promptQueueCounterText),
    // no damage notes, no source line.
    expect(modal.queryByText('(Advantage)')).not.toBeInTheDocument();
    expect(modal.queryByText('(Disadvantage)')).not.toBeInTheDocument();
    expect(document.querySelector('.sp-queue-info')).toBeNull();
    expect(modal.queryByText('Half damage on successful save')).not.toBeInTheDocument();
    expect(modal.queryByText('No damage on successful save')).not.toBeInTheDocument();
    expect(document.querySelector('.sp-source')).toBeNull();
  });

  it('folds (Disadvantage) — never (Advantage) — into the prompt sentence for a disadvantaged save', async () => {
    renderModal();
    const modal = await openPrompt('subscriber-trigger-disadvantage');

    expect(modal.getByText(sentence('testTarget3 must make a STR saving throw. (Disadvantage)'))).toBeInTheDocument();
    expect(modal.queryByText('(Advantage)')).not.toBeInTheDocument();
    expect(modal.getByText('DC 14')).toBeInTheDocument();
  });

  it('folds (Advantage) — never (Disadvantage) — into the prompt sentence for an advantage-flagged save', async () => {
    renderModal();
    const modal = await openPrompt('subscriber-trigger-advantage');

    // The prompt's own advantage:true flag labels the sentence even with no
    // aura/dodge/buff sources in play (the te-driven pre-roll chip is
    // .holy-aura's face).
    expect(modal.getByText(sentence('testTarget5 must make a CHA saving throw. (Advantage)'))).toBeInTheDocument();
    expect(modal.queryByText('(Disadvantage)')).not.toBeInTheDocument();
    expect(modal.getByText('DC 13')).toBeInTheDocument();
  });

  // ── Damage-outcome notes + source attribution ──

  it('shows the plain half-damage note and source line for a half-damage save with no evasion in play', async () => {
    renderModal();
    const modal = await openPrompt('subscriber-trigger-dex');

    expect(modal.getByText(sentence('testTarget must make a DEX saving throw.'))).toBeInTheDocument();
    expect(modal.getByText('Half damage on successful save')).toBeInTheDocument();
    expect(modal.getByText('Source: Sacred Flame')).toBeInTheDocument();
    // The 'half' and 'none' note arms are exclusive on one prompt.
    expect(modal.queryByText('No damage on successful save')).not.toBeInTheDocument();
  });

  it('shows the "No damage on successful save" note for a dcSuccess "none" save', async () => {
    renderModal();
    const modal = await openPrompt('subscriber-trigger-none-dc');

    expect(modal.getByText(sentence('testTarget4 must make a WIS saving throw.'))).toBeInTheDocument();
    expect(modal.getByText('No damage on successful save')).toBeInTheDocument();
    expect(modal.queryByText('Half damage on successful save')).not.toBeInTheDocument();
  });

  it('names both damage formulas for a dual-damage prompt (MA-0427)', async () => {
    renderModal();
    const modal = await openPrompt('subscriber-trigger-dual-damage');

    expect(modal.getByText('2d8 Piercing + 3d8 Fire damage, half on a successful save')).toBeInTheDocument();
    expect(modal.getByText('DC 18')).toBeInTheDocument();
  });
});
