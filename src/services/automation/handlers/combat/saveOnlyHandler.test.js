// @maintained-by-ai 2026-11-27 — save_only lane sweep: full-array commit/refusal censuses, dedup negative legs, promptId-gate zero-spend, stray-listener drain + re-fire double-spend detector.
// saveOnlyHandler (dispatched as automation type `save_only` from
// src/services/automation/index.js — distinct from saveAttackHandler).
// Lane map: popup/prompt construction, refusal-gate censuses (no_target /
// cannot_target_self), and the promptId-gated 'save-result' commit paths
// (success/fail) with exact ordered setRuntimeValue/addEntry/addExpiration
// censuses. The save-dismissed detach family lives in
// saveOnlyHandler.dismiss.test.js — do not cross-remove.
// Known source defect pinned around (NOT laundered): saveOnlyHandler.js:96
// and :188 call getRuntimeValue WITHOUT campaignName. Read-target assertions
// here compare only the first two args so a future fix does not break them.
// The hardcoded addExpiration on both branches (ignores custom
// auto.effects, saveOnlyHandler.js:114-117/:136-138) is deliberately NOT
// asserted in the custom-effect tests.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './saveOnlyHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as expirations from '../../../rules/effects/expirations.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

const FROZEN_NOW = 1_700_000_000_000;

// Unique promptId per mint: handle() registers window listeners gated on ITS
// OWN promptId; shared ids across tests would re-fire stale handlers
// (double-spend). The afterEach drain below is the belt to that braces.
let promptCounter = 0;
let lastDispatchedPromptId = null;

const realAdd = window.addEventListener.bind(window);
const realRemove = window.removeEventListener.bind(window);
const strayHandlers = new Set();

function makePlayerStats() {
  return {
    name: 'TestHero',
    level: 3,
    proficiency: 2,
    abilities: [
      { name: 'CON', modifier: 2 },
      { name: 'CHA', modifier: 3 },
    ],
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Stunning Strike',
    automation: { type: 'save_only', ...automation },
  };
}

function setupMocks() {
  savePrompt.buildSaveDc.mockReturnValue(14);
  savePrompt.createSaveListener.mockImplementation((_campaignName, _config) => {
    // Real contract (savePrompt.js:105-145): returns { promptId, promise } —
    // a one-shot 'save-result' listener routed BY its own promptId that
    // self-resolves and detaches. Ids stay unique-per-mint so nothing leaks.
    const promptId = `save-guid-${++promptCounter}`;
    const promise = new Promise((resolve) => {
      const route = (event) => {
        if (event.detail.promptId !== promptId) return;
        realRemove('save-result', route);
        resolve(event.detail);
      };
      window.addEventListener('save-result', route);
    });
    return { promptId, promise };
  });
  targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
  runtimeState.getRuntimeValue.mockReturnValue(undefined);
  runtimeState.setRuntimeValue.mockResolvedValue(undefined);
  logService.addEntry.mockResolvedValue({});
  expirations.addExpiration.mockReturnValue(undefined);
}

const latestPromptId = () =>
  savePrompt.createSaveListener.mock.results.at(-1).value.promptId;

// Dispatches against the promptId issued by the most recent handle() call.
function dispatchSaveResult(success) {
  lastDispatchedPromptId = latestPromptId();
  window.dispatchEvent(new CustomEvent('save-result', {
    detail: { promptId: lastDispatchedPromptId, success },
  }));
}

const spendCount = () =>
  runtimeState.setRuntimeValue.mock.calls.length +
  logService.addEntry.mock.calls.length +
  expirations.addExpiration.mock.calls.length;

// Which runtime lanes the handler READ, as [creature, key] pairs — arg-count
// agnostic so the campaignName-dropped-read defect (:96/:188) can be fixed
// without touching these pins.
const readTargets = () =>
  runtimeState.getRuntimeValue.mock.calls.map((c) => [c[0], c[1]]);

// ── Shared harness (single beforeEach/afterEach for the whole file) ──

beforeEach(() => {
  vi.resetAllMocks();
  setupMocks();
  vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
  vi.spyOn(window, 'addEventListener').mockImplementation((type, fn, opts) => {
    if (type === 'save-result' || type === 'save-dismissed') strayHandlers.add(fn);
    return realAdd(type, fn, opts);
  });
  vi.spyOn(window, 'removeEventListener').mockImplementation((type, fn, opts) => {
    strayHandlers.delete(fn);
    return realRemove(type, fn, opts);
  });
  lastDispatchedPromptId = null;
});

afterEach(() => {
  // Double-spend detector: re-firing an ALREADY-resolved promptId must not
  // spend state again (listener self-detach pin, save-listener hazard).
  if (lastDispatchedPromptId) {
    const before = spendCount();
    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: lastDispatchedPromptId, success: true },
    }));
    expect(spendCount()).toBe(before);
  }
  // Stray-listener drain: every save-event listener still live at test end
  // (undispatched prompts) is force-removed so it cannot fire in later tests.
  for (const fn of strayHandlers) {
    realRemove('save-result', fn);
    realRemove('save-dismissed', fn);
  }
  strayHandlers.clear();
  vi.restoreAllMocks();
});

// ── Popup + prompt construction ────────────────────────────────

describe('saveOnlyHandler.handle - popup and prompt construction', () => {
  it('full-shape popup, DC build, and save-listener config for an explicit saveType', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ saveType: 'WIS' });

    const result = await handle(action, ps, campaignName, mapName);

    expect(targetResolver.resolveTarget).toHaveBeenCalledWith(campaignName, 'TestHero');
    expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(action.automation, ps);
    // Exact distinct config across branches: explicit saveType is forwarded verbatim.
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin',
      saveType: 'WIS',
      saveDc: 14,
    });
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Stunning Strike',
        targetName: 'Goblin',
        description: 'Target Goblin must make a WIS saving throw (DC 14).',
        automation: { type: 'save_only', saveType: 'WIS' },
      },
    });
  });

  it('omitted saveType defaults to CON across popup, listener config, and ability_use row', async () => {
    const ps = makePlayerStats();
    const action = makeAction({});

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toBe(
      'Target Goblin must make a CON saving throw (DC 14).'
    );
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin',
      saveType: 'CON',
      saveDc: 14,
    });
    // The queued prompt's spend row: full-array census, exact object.
    expect(logService.addEntry.mock.calls).toEqual([[campaignName, {
      type: 'ability_use',
      characterName: 'TestHero',
      abilityName: 'Stunning Strike',
      description: 'Stunning Strike triggered — target Goblin must make CON save (DC 14)',
      promptId: latestPromptId(),
    }]]);
  });
});

// ── Refusal gates ──────────────────────────────────────────────

describe('saveOnlyHandler.handle - refusal gates', () => {
  // Regression (self-harm fallback family): every save_only consumer
  // (Stunning Strike, Color Spray, Entangle, Grease, Arms of Hadar, Dominate
  // Monster) requires another creature — an unarmed or self-armed click must
  // never queue a saving-throw prompt against the caster.
  it.each([
    {
      label: 'no target armed',
      resolved: null,
      reason: 'no_target',
      message: 'No target selected — Stunning Strike requires another creature. Select a target in combat first.',
    },
    {
      label: 'armed target is the caster',
      resolved: { target: { name: 'TestHero' } },
      reason: 'cannot_target_self',
      message: "You can't target yourself with Stunning Strike — it requires another creature.",
    },
  ])('refuses when $label: exact popup, one refusal row, zero prompt/state spend', async ({ resolved, reason, message }) => {
    targetResolver.resolveTarget.mockResolvedValue(resolved);

    const result = await handle(makeAction({ saveType: 'CON' }), makePlayerStats(), campaignName, mapName);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Stunning Strike',
        automationType: 'save_only',
        description: message,
        automation: { type: 'save_only', saveType: 'CON' },
      },
    });
    // Full-array refusal-row census: exactly one row, exact shape
    // (refusal slug, description composition, frozen timestamp).
    expect(logService.addEntry.mock.calls).toEqual([[campaignName, {
      type: 'automation',
      characterName: 'TestHero',
      abilityName: 'Stunning Strike',
      automationType: 'save_only',
      automationDetail: 'stunning_strike_refused',
      reason,
      description: `Stunning Strike refused — ${reason}`,
      timestamp: FROZEN_NOW,
    }]]);
    // Zero spend on every later channel.
    expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    expect(runtimeState.getRuntimeValue).not.toHaveBeenCalled();
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
  });
});

// ── Save-result success commits ────────────────────────────────

describe('saveOnlyHandler.handle - save result success', () => {
  it('success: exact ordered commit census (canonical keys, read targets, log rows, expiration)', async () => {
    // CLA-342: the success branch must write the canonical keys consumed by
    // CharSheet.conditionEffects ('stunned_speedHalved'), never timestamped
    // dead keys — the exact-array census below subsumes the old
    // /_\\d{13}$/ regex pin.
    await handle(makeAction({ saveType: 'WIS' }), makePlayerStats(), campaignName, mapName);
    dispatchSaveResult(true);

    expect(readTargets()).toEqual([
      ['Goblin', 'activeConditions'],
      ['TestHero', '_advantageOn_Goblin'],
    ]);
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['Goblin', 'stunned_speedHalved', true, campaignName],
      ['TestHero', '_advantageOn_Goblin', ['Goblin'], campaignName],
    ]);
    expect(logService.addEntry.mock.calls).toEqual([
      [campaignName, {
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Stunning Strike',
        description: 'Stunning Strike triggered — target Goblin must make WIS save (DC 14)',
        promptId: latestPromptId(),
      }],
      [campaignName, {
        type: 'save_result',
        characterName: 'TestHero',
        rollType: 'save-save_only',
        targetName: 'Goblin',
        saveDc: 14,
        saveType: 'WIS',
        success: true,
        description: 'Goblin succeeded on WIS save. Speed halved until start of next turn.',
      }],
    ]);
    expect(expirations.addExpiration.mock.calls).toEqual([[{
      attackerName: 'TestHero',
      targetName: 'Goblin',
      effects: [
        { type: 'stunned', condition: 'speed_halved' },
        { type: 'advantage_on_target' },
      ],
      campaignName,
      rounds: undefined,
      expireOnCreatureName: 'Goblin',
    }]]);
  });

  it('ignores save-result events with a non-matching promptId: zero reads, writes, or log rows', async () => {
    await handle(makeAction({ saveType: 'CON' }), makePlayerStats(), campaignName, mapName);
    const rowsBefore = logService.addEntry.mock.calls.length;

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: 'different-prompt', success: true },
    }));

    // The id-gate short-circuits BEFORE the activeConditions read.
    expect(runtimeState.getRuntimeValue).not.toHaveBeenCalled();
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    expect(logService.addEntry.mock.calls).toHaveLength(rowsBefore);
  });

  it('success dedup: already-listed advantage target gets no second write', async () => {
    // Negative leg of the applySuccessEffects includes() guard
    // (saveOnlyHandler.js:189) — the positive leg is pinned by the census
    // above (stored list starts empty/undefined).
    runtimeState.getRuntimeValue.mockImplementation((_name, key) =>
      key === '_advantageOn_Goblin' ? ['Goblin'] : undefined);

    await handle(makeAction({ saveType: 'CON' }), makePlayerStats(), campaignName, mapName);
    dispatchSaveResult(true);

    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['Goblin', 'stunned_speedHalved', true, campaignName],
    ]);
  });

  it('non-Stunning-Strike action without effects has an empty default success lane: no writes, row still logged', async () => {
    // getDefaultEffects() negative leg (saveOnlyHandler.js:17-22):
    // success: [] means a passed save spends nothing on the runtime lane.
    // addExpiration NOT censused here — its success payload is hardcoded and
    // would fire Stunning-Strike stun semantics for this custom action
    // (flagged source defect, see header).
    const action = { name: 'Color Spray', automation: { type: 'save_only', saveType: 'CON' } };

    await handle(action, makePlayerStats(), campaignName, mapName);
    dispatchSaveResult(true);

    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry.mock.calls.at(-1)[1]).toMatchObject({
      type: 'save_result',
      targetName: 'Goblin',
      success: true,
    });
  });
});

// ── Save-result fail commits ───────────────────────────────────

describe('saveOnlyHandler.handle - save result fail', () => {
  it('fail: exact ordered commit census (condition append, read targets, log rows, expiration)', async () => {
    await handle(makeAction({ saveType: 'WIS' }), makePlayerStats(), campaignName, mapName);
    dispatchSaveResult(false);

    expect(readTargets()).toEqual([['Goblin', 'activeConditions']]);
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['Goblin', 'activeConditions', ['stunned'], campaignName],
    ]);
    expect(logService.addEntry.mock.calls).toEqual([
      [campaignName, {
        type: 'ability_use',
        characterName: 'TestHero',
        abilityName: 'Stunning Strike',
        description: 'Stunning Strike triggered — target Goblin must make WIS save (DC 14)',
        promptId: latestPromptId(),
      }],
      [campaignName, {
        type: 'save_result',
        characterName: 'TestHero',
        rollType: 'save-save_only',
        targetName: 'Goblin',
        saveDc: 14,
        saveType: 'WIS',
        success: false,
        description: 'Goblin failed WIS save. Stunned until start of next turn.',
      }],
    ]);
    expect(expirations.addExpiration).toHaveBeenCalledWith({
      attackerName: 'TestHero',
      targetName: 'Goblin',
      effects: [{ type: 'stunned', condition: 'stunned' }],
      campaignName,
      rounds: undefined,
      expireOnCreatureName: 'Goblin',
    });
  });

  it('fail dedup: existing case-variant condition is replaced, not duplicated', async () => {
    // Covers both legs of the filter-then-append at
    // saveOnlyHandler.js:120-121: 'Stunned' is evicted (case-insensitive)
    // and 'stunned' re-appended at the end; 'prone' untouched.
    runtimeState.getRuntimeValue.mockImplementation((_name, key) =>
      key === 'activeConditions' ? ['prone', 'Stunned'] : undefined);

    await handle(makeAction({ saveType: 'CON' }), makePlayerStats(), campaignName, mapName);
    dispatchSaveResult(false);

    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['Goblin', 'activeConditions', ['prone', 'stunned'], campaignName],
    ]);
  });

  it('custom fail condition drives the appended key (Color Spray blinded scenario)', async () => {
    // conditionKey = effects.fail[0].condition branch. addExpiration is not
    // censused — hardcoded Stunning-Strike expiration is a flagged source
    // defect for custom conditions (see header).
    const action = {
      name: 'Color Spray',
      automation: {
        type: 'save_only',
        saveType: 'CON',
        effects: { fail: [{ type: 'blinded', condition: 'blinded' }] },
      },
    };

    await handle(action, makePlayerStats(), campaignName, mapName);
    dispatchSaveResult(false);

    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['Goblin', 'activeConditions', ['blinded'], campaignName],
    ]);
  });
});

// ── Custom success effects ─────────────────────────────────────

describe('saveOnlyHandler.handle - custom success effects', () => {
  it('custom success condition becomes the stunned_<condition> runtime key and no other write fires', async () => {
    // applySuccessEffects ternary alternate branch (saveOnlyHandler.js:182):
    // condition !== 'speed_halved' → `stunned_custom_slow`. The custom
    // success lane has no advantage_on_target entry, so the exact-array
    // census below proves that is the ONLY write.
    const action = makeAction({
      saveType: 'CON',
      effects: {
        success: [{ type: 'speed_halved', condition: 'custom_slow' }],
        fail: [{ type: 'charmed', condition: 'charmed' }],
      },
    });

    await handle(action, makePlayerStats(), campaignName, mapName);
    dispatchSaveResult(true);

    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['Goblin', 'stunned_custom_slow', true, campaignName],
    ]);
  });
});
