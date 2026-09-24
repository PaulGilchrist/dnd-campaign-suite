// MA-1020: ShapeShiftModal — the Imp Shape-Shift form chooser, reusing the
// MA-0275 AnimalSpiritVariantModal mc-overlay/sp-modal byte-shape (smallest
// existing chooser). Four form rows (Rat/Raven/Spider/True Form) with the
// RAW Speed copy; ONE row click resolves that form (the pick IS the
// resolution — no save leg); backdrop or Cancel declines with an honest
// zero-write record. Null chooser renders nothing (byte-inert mount).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { ShapeShiftModal } from './ShapeShiftModal.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SHAPE_ROW = monsters.find(m => m.index === 'imp').actions[2];
const CHOOSER = { action: SHAPE_ROW };

function renderModal(overrides = {}) {
  const onResolve = vi.fn();
  const onSkip = vi.fn();
  const utils = render(
    <ShapeShiftModal chooser={CHOOSER} monsterName="Imp 1" onResolve={onResolve} onSkip={onSkip} {...overrides} />
  );
  return { ...utils, onResolve, onSkip };
}

describe('MA-1020 ShapeShiftModal chooser', () => {
  it('null chooser renders nothing', () => {
    const { container } = render(<ShapeShiftModal chooser={null} monsterName="Imp 1" onResolve={vi.fn()} onSkip={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('lists all four forms with RAW Speed copy', () => {
    const { container } = renderModal();
    const rows = [...container.querySelectorAll('.shape-shift-row')];
    expect(rows.length).toBe(4);
    const text = rows.map(r => r.textContent);
    expect(text[0]).toContain('Rat');
    expect(text[0]).toContain('walk 20 ft.');
    expect(text[1]).toContain('Raven');
    expect(text[1]).toContain('walk 20 ft., fly 60 ft.');
    expect(text[2]).toContain('Spider');
    expect(text[2]).toContain('walk 20 ft., climb 20 ft.');
    expect(text[3]).toContain('True Form');
    expect(text[3]).toContain('stat block');
    expect(container.textContent).toContain('No uses limit and no expiration clock');
  });

  it('ONE row click resolves exactly that form payload', () => {
    const { container, onResolve, onSkip } = renderModal();
    fireEvent.click(container.querySelectorAll('.shape-shift-row')[1]);
    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve.mock.calls[0]).toEqual([{ name: 'Raven', speed: 20, fly: 60 }]);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('Cancel and backdrop click skip; clicks inside the .sp-modal body do not', () => {
    const { container, onSkip, onResolve } = renderModal();
    fireEvent.click(container.querySelector('.sp-dismiss-btn'));
    expect(onSkip).toHaveBeenCalledTimes(1);
    fireEvent.click(container.querySelector('.mc-overlay--shape-shift'));
    expect(onSkip).toHaveBeenCalledTimes(2);
    fireEvent.click(container.querySelector('.sp-modal p'));
    expect(onSkip).toHaveBeenCalledTimes(2);
    expect(onResolve).not.toHaveBeenCalled();
  });
});
