// @maintained-by-ai
// Contract pin: index.js dispatches automation type `natural_recovery` to this
// handler; CharSpecialActions.jsx routes the returned modalName
// `'naturalRecovery'` to setNaturalRecoveryModal (Druid short-rest slot
// recovery). The handler is a pure passthrough whose only branch is the
// `description || ''` fallback — one exact-shape pin plus that fallback table
// covers every input. Rest-scoped resets of naturalRecoverySlots belong to
// restRules-longRest/restRules-shortRest; slot math lives in the spellSlot
// lanes — this file owns only the modal descriptor it composes.
import { describe, it, expect } from 'vitest';

import { handle } from './naturalRecoveryHandler.js';

// makeAction-style helper: MERGES overrides onto a base action, never replaces.
function makeAction(overrides = {}) {
  return {
    name: 'Natural Recovery',
    description: 'Recover expended spell slots',
    automation: { type: 'natural_recovery', extra: 'data' },
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('naturalRecoveryHandler.handle', () => {
  it('returns the naturalRecovery modal descriptor with action fields passed through', async () => {
    const action = makeAction();
    const result = await handle(action, {}, 'campaign', 'map');

    expect(result).toEqual({
      type: 'modal',
      modalName: 'naturalRecovery',
      payload: {
        name: 'Natural Recovery',
        description: 'Recover expended spell slots',
        automation: { type: 'natural_recovery', extra: 'data' },
      },
    });

    // No-side-effect pin: playerStats/campaign/map are ignored by signature —
    // the output is determined solely by the action.
    expect(
      await handle(action, { name: 'Druid', level: 5 }, 'other-campaign', 'other-map')
    ).toEqual(result);
  });

  it('falls back description to empty string and passes automation through uncoerced', async () => {
    // The `description || ''` branch is the handler's only logic.
    for (const description of [undefined, null, '']) {
      const result = await handle(makeAction({ description }), {}, 'campaign', 'map');
      expect(result.payload.description).toBe('');
    }

    // Automation passes through as-is — never coerced to {} or null.
    const nullAuto = await handle(makeAction({ automation: null }), {}, 'campaign', 'map');
    expect(nullAuto.payload.automation).toBe(null);

    const bare = await handle({ name: 'Natural Recovery' }, {}, 'campaign', 'map');
    expect(bare.payload).toEqual({ name: 'Natural Recovery', description: '' });
    expect(bare.payload.automation).toBe(undefined);
  });
});
