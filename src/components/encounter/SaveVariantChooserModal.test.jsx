// MA-1436: SaveVariantChooserModal — the generic choose-one chooser renders
// the structured variants payload, resolves the picked variant object, and
// the skip button resolves null (zero-save decline upstream).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SaveVariantChooserModal } from './SaveVariantChooserModal.jsx';
import monstersData from '../../../public/data/monsters.json';

const FEY_MELODY = monstersData.find(m => m.index === 'satyr-revelmaster').actions.find(a => a.name === 'Fey Melody');

function makeChooser() {
  return { action: FEY_MELODY, target: { name: 'Bandit 1' }, variants: FEY_MELODY.variants };
}

describe('MA-1436 SaveVariantChooserModal', () => {
  it('renders both song variants + the target/DC context', () => {
    const { getByText } = render(
      <SaveVariantChooserModal chooser={makeChooser()} monsterName="Satyr Revelmaster 1" onResolve={vi.fn()} onSkip={vi.fn()} />
    );
    expect(getByText('Fey Melody — Choose Variant')).toBeTruthy();
    expect(getByText(/targets/).textContent).toContain('Bandit 1');
    expect(getByText('Charming')).toBeTruthy();
    expect(getByText('Frightening')).toBeTruthy();
  });

  it('clicking a variant resolves that exact variant object', () => {
    const onResolve = vi.fn();
    const { getByText } = render(
      <SaveVariantChooserModal chooser={makeChooser()} monsterName="Satyr Revelmaster 1" onResolve={onResolve} onSkip={vi.fn()} />
    );
    fireEvent.click(getByText('Charming'));
    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve.mock.calls[0][0]).toMatchObject({ key: 'charming', conditions: ['charmed', 'incapacitated'], rounds: 10 });
  });

  it('cancel resolves null — the decline seam (no save, no effect)', () => {
    const onSkip = vi.fn();
    const { getByText } = render(
      <SaveVariantChooserModal chooser={makeChooser()} monsterName="Satyr Revelmaster 1" onResolve={vi.fn()} onSkip={onSkip} />
    );
    fireEvent.click(getByText('Use without variant'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('null chooser renders nothing', () => {
    const { container } = render(<SaveVariantChooserModal chooser={null} monsterName="X" onResolve={vi.fn()} onSkip={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });
});
