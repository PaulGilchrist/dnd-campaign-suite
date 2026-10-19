// @maintained-by-ai
// Lane: EffectAdder overflow mount edge cases — ONLY the unowned malformed-input /
// default-tab paths, asserted at modal-open level.
// NOT owned here (cited): tab-bar existence + overlay/modal clicks →
// EffectAdder.rendering.test.jsx; conditions tab face + DC sanitizer →
// EffectAdder.conditions.test.jsx (#856); concentration tab face →
// EffectAdder.concentration.test.jsx (#855); effects search input + group
// census + config fields → EffectAdder.effects-browsing/config.test.jsx;
// empty/undefined/null creatures dropdown + modal-open integrity →
// EffectAdder.creatures.test.jsx (#857); unknown-tab handler fall-through →
// createEffectAdderHandlers.test.jsx (#839).
// Old -> new map (3 -> 2):
//   'render without crashing when all props are minimal' -> test 1
//     (vacuous modal-exists strengthened to pin the default-tab routing at
//     EffectAdder.jsx:18; the creatures=[] crash guard half is CUT, owned by
//     creatures.test.jsx #857 which asserts modal + placeholder options there)
//   'invalid initialTab gracefully' -> test 2
//     (strengthens the real authored contract: NO panel falls back — the three
//     panel conditionals at :131/:179/:301 all miss — and the tab bar recovers)
//   'effects tab as initial tab' -> CUT: search input + 'Attack' group census are
//     byte-owned by effects-browsing.test.jsx:22-35; direct-mount vs click-path is
//     not an authored distinction (initialTab is just useState seeding, :18).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EffectAdder from './EffectAdder.jsx';

describe('EffectAdder - mount edge cases', () => {
  it('opens the conditions panel, and only that, when initialTab is missing', () => {
    render(
      <EffectAdder
        targetName='Test'
        onCancel={vi.fn()}
        onApply={vi.fn()}
        creatures={[{ name: 'Alice' }]}
      />
    );
    // Default routing (initialTab || 'conditions'): the conditions panel is live...
    expect(screen.getByRole('button', { name: 'Blinded' })).toBeInTheDocument();
    // ...and neither of the other two panels leaked into the mount.
    expect(screen.queryByPlaceholderText('Search effects…')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Spell Name')).not.toBeInTheDocument();
  });

  it('renders no tab panel for an invalid initialTab, and switching to a valid tab recovers the panel', () => {
    render(
      <EffectAdder
        targetName='Goblin'
        initialTab='invalidTab'
        onCancel={vi.fn()}
        onApply={vi.fn()}
        creatures={[{ name: 'Alice' }]}
      />
    );
    // Modal shell mounts, but NO panel falls back — the authored semantics of the
    // three activeTab conditionals (:131/:179/:301) all missing on unknown keys.
    expect(screen.getByRole('heading', { level: 3, name: 'Goblin' })).toBeInTheDocument();
    expect(screen.queryByText('Blinded')).toBeNull();
    expect(screen.queryByPlaceholderText('Search effects…')).toBeNull();
    expect(screen.queryByLabelText('Spell Name')).toBeNull();
    // The tab bar stays functional: a valid click mounts that panel.
    fireEvent.click(screen.getByRole('button', { name: 'Concentration' }));
    expect(screen.getByLabelText('Spell Name')).toBeInTheDocument();
  });
});
