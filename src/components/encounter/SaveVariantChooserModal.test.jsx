// @maintained-by-ai
// MA-1436 chooser-modal UI seam — the offer/select/skip fork, canonical owner per
// MonsterCardHelpers.save-variant-chooser.test.js:17. Props-in/callback-out leaf,
// zero mocks: arms render exact-order, each arm click emits that exact disk variant
// payload exactly once, "Use without variant" fires the skip fork with zero resolve,
// and no-arms → renders nothing (never opens a chooser with nothing to choose).
// Cited, NOT re-pinned here:
// - Row disk lock + parse arm/inert truth table: MonsterCardHelpers.save-variant-chooser.test.js (#743)
// - Consumer lane chip→arms→save-ctx→skip→close end-to-end: MonsterCardModal.ma1881-demogorgon-legendary-gaze.test.jsx (#744)
// - Per-variant save outcomes: SaveAttackAoeModal.fey-melody-variant.test.jsx
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SaveVariantChooserModal } from './SaveVariantChooserModal.jsx';
import monstersData from '../../../public/data/monsters.json';

// Real disk rows — the variants[] payload is never restated as fixtures (#772/#773).
const FEY_MELODY = monstersData.find(m => m.index === 'satyr-revelmaster').actions.find(a => a.name === 'Fey Melody');

const chooser = () => ({ action: FEY_MELODY, target: { name: 'Bandit 1' }, variants: FEY_MELODY.variants });

function renderChooser(overrides = {}) {
  const onResolve = vi.fn();
  const onSkip = vi.fn();
  const utils = render(
    <SaveVariantChooserModal
      chooser={chooser()}
      monsterName="Satyr Revelmaster 1"
      onResolve={onResolve}
      onSkip={onSkip}
      {...overrides}
    />
  );
  return { ...utils, onResolve, onSkip };
}

describe('MA-1436 SaveVariantChooserModal — offer / select / skip fork', () => {
  it('offers every arm exact-order with action + target + DC context', () => {
    const { container, getByText } = renderChooser();
    expect(getByText('Fey Melody — Choose Variant')).toBeTruthy();
    expect(Array.from(container.querySelectorAll('.save-variant-row strong')).map(el => el.textContent))
      .toEqual(['Charming', 'Frightening']);
    const ctx = container.querySelector('.sp-body p').textContent;
    expect(ctx).toContain('Satyr Revelmaster 1');
    expect(ctx).toContain('Bandit 1');
    expect(ctx).toContain(`DC ${FEY_MELODY.save_dc}`);
    expect(ctx).toContain(FEY_MELODY.save_type);

    // Area-row honesty: no explicit target names the area, never a blank.
    const { container: areaOnly } = renderChooser({ chooser: { action: FEY_MELODY, variants: FEY_MELODY.variants } });
    expect(areaOnly.querySelector('.sp-body p').textContent).toContain('each creature in the area');
  });

  it.each(FEY_MELODY.variants)('clicking the $label arm fires onResolve once with that exact disk variant, never the skip fork', (variant) => {
    const { getByText, onResolve, onSkip } = renderChooser();
    fireEvent.click(getByText(variant.label));
    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve).toHaveBeenCalledWith(variant);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('"Use without variant" fires the skip fork once with zero resolve (the decline seam)', () => {
    const { getByText, onResolve, onSkip } = renderChooser();
    fireEvent.click(getByText('Use without variant'));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onResolve).not.toHaveBeenCalled();
  });

  it.each([
    ['chooser missing', null],
    ['variants missing', { action: FEY_MELODY, target: { name: 'Bandit 1' } }],
  ])('renders nothing when there is nothing to choose (%s)', (_case, chooserProp) => {
    const { container } = renderChooser({ chooser: chooserProp });
    expect(container.innerHTML).toBe('');
  });
});
