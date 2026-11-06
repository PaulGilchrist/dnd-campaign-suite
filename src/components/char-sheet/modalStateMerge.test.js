// @maintained-by-ai
// Lane map: host mounting under these merge rules →
// CharActionModals.sneak-chooser-rearm.test.jsx; precedence for OPEN
// collisions pinned upstream by CharActionModals.rendering.test.jsx.
import { describe, it, expect } from 'vitest';
import { mergeModalStates } from './modalStateMerge.js';

const PROPS_A = { action: { name: 'Devious Strikes' }, targetName: 'ElderPaladin' };
const PROPS_B = { action: { name: 'Devious Strikes' }, targetName: 'War_Cleric' };

describe('mergeModalStates — two-channel char-sheet modal merge', () => {
  it('a stale close-null in the spell channel never vetoes a live local open (sneak-cycle re-arm)', () => {
    // Cycle-1 close forwarded { attackRiderModal: null } into the parent
    // mirror; cycle-2 pipeline opened the chooser in modalState only.
    const merged = mergeModalStates(
      { attackRiderModal: PROPS_A },
      { attackRiderModal: null }
    );
    expect(merged.attackRiderModal).toBe(PROPS_A);
  });

  it('spell-channel opens still win collisions with local opens (precedence kept)', () => {
    const merged = mergeModalStates(
      { attackRiderModal: PROPS_A },
      { attackRiderModal: PROPS_B }
    );
    expect(merged.attackRiderModal).toBe(PROPS_B);
  });

  it('a real close lands (both channels null → merged null)', () => {
    const merged = mergeModalStates(
      { attackRiderModal: null },
      { attackRiderModal: null }
    );
    expect(merged.attackRiderModal).toBeNull();
  });

  it('spell-owned modals (no local key) mount, and spell-owned closes stay closed', () => {
    const mounted = mergeModalStates({}, { wildMagicSurgeModal: { mode: 'roll' } });
    expect(mounted.wildMagicSurgeModal).toEqual({ mode: 'roll' });

    const closed = mergeModalStates({}, { wildMagicSurgeModal: null });
    expect(closed.wildMagicSurgeModal).toBeNull();
  });

  it('local-only keys are preserved untouched', () => {
    const merged = mergeModalStates({ secondaryTargetModal: PROPS_A }, { teleportModal: null });
    expect(merged.secondaryTargetModal).toBe(PROPS_A);
    expect(merged.teleportModal).toBeNull();
  });
});
