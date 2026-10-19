// @maintained-by-ai
// MA-1020: ShapeShiftModal — the Imp Shape-Shift form chooser, reusing the
// MA-0275 AnimalSpiritVariantModal mc-overlay/sp-modal byte-shape (smallest
// existing chooser). This file owns the MODAL UI contract only: forms read
// from the real imp disk bytes render in authored order with the modal-owned
// Speed labels; ONE row click forwards that exact form object (the pick IS
// the resolution — no save leg); the dismiss button skips once and backdrop/
// body clicks are inert. Stamps, logs, and popup bytes belong to
// services/encounters/monsterShapeShift.*; chip affordance belongs to
// MonsterAction.*-shape-shift-chip tests. Null/malformed chooser mounts
// byte-inert (nothing rendered).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { ShapeShiftModal } from './ShapeShiftModal.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SHAPE_ROW = monsters.find(m => m.index === 'imp').actions[2];
const FORMS = SHAPE_ROW.automation.forms;
const CHOOSER = { action: SHAPE_ROW };

function renderModal() {
  const onResolve = vi.fn();
  const onSkip = vi.fn();
  const utils = render(
    <ShapeShiftModal chooser={CHOOSER} monsterName="Imp 1" onResolve={onResolve} onSkip={onSkip} />
  );
  return { ...utils, onResolve, onSkip };
}

describe('MA-1020 ShapeShiftModal chooser', () => {
  // Guard is !Array.isArray(forms) — every shape without an authored forms
  // array mounts byte-inert (empty forms [] is NOT inert: it renders chrome).
  it.each([
    ['null chooser', null],
    ['undefined chooser', undefined],
    ['empty chooser', {}],
    ['chooser without action', { action: null }],
    ['action without automation', { action: {} }],
  ])('%s renders nothing', (_label, chooser) => {
    const { container } = render(
      <ShapeShiftModal chooser={chooser} monsterName="Imp 1" onResolve={vi.fn()} onSkip={vi.fn()} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders all four forms in authored order with exact modal labels and honest no-clock copy', () => {
    const { container } = renderModal();
    const rows = [...container.querySelectorAll('.shape-shift-row')];
    expect(rows.map(r => r.querySelector('strong').textContent)).toEqual(['Rat', 'Raven', 'Spider', 'True Form']);
    expect(rows.map(r => r.textContent)).toEqual([
      'RatSpeed walk 20 ft.',
      'RavenSpeed walk 20 ft., fly 60 ft.',
      'SpiderSpeed walk 20 ft., climb 20 ft.',
      'True FormReturns to true form — Speed reverts to the stat block',
    ]);
    expect(container.textContent).toContain('No uses limit and no expiration clock');
    expect(container.querySelector('.sp-dismiss-btn').textContent).toBe('Shape-shift without changing');
  });

  it.each(FORMS.map((form, i) => [form.name, i, form]))(
    'ONE %s row click forwards that exact form payload, never skips',
    (name, i, form) => {
      const { container, onResolve, onSkip } = renderModal();
      fireEvent.click(container.querySelectorAll('.shape-shift-row')[i]);
      expect(onResolve).toHaveBeenCalledTimes(1);
      expect(onResolve).toHaveBeenCalledWith(form);
      expect(onSkip).not.toHaveBeenCalled();
    }
  );

  it('Cancel skips once; backdrop and modal-body clicks are inert', () => {
    const { container, onResolve, onSkip } = renderModal();
    fireEvent.click(container.querySelector('.sp-dismiss-btn'));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onResolve).not.toHaveBeenCalled();

    fireEvent.click(container.querySelector('.mc-overlay--shape-shift'));
    fireEvent.click(container.querySelector('.sp-modal p'));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onResolve).not.toHaveBeenCalled();
    expect(container.querySelector('.sp-modal')).toBeTruthy();
  });
});
