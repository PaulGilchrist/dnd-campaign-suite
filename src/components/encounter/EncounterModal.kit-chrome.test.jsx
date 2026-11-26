// @maintained-by-ai 2026-11-22
/* Lane — .ct-* design-kit convergence (QA backlog tranche 1, Encounters view):
 * the Load/Save/Rename modal shell rides the shared App.css kit tiers —
 * .ct-modal-overlay / .ct-modal / .ct-modal-header / .ct-modal-close /
 * .ct-modal-body chrome, .ct-label/.ct-input fields, the .ct-btn hierarchy for
 * every button (rows: sm / sm-primary / sm-danger), and .ct-empty-state for
 * the no-saved-encounters face. The retired bespoke tokens
 * (.encounter-modal-overlay/-header/-close/-body/-empty and the
 * .encounter-btn-* variants) must render ZERO. Backdrop dismiss is a pinned
 * behavior lane: the in-panel guard follows the kit class (.ct-modal), so an
 * inside click never closes while a pure backdrop click does.
 * Harness mirrors EncounterModal.test.jsx (real component, no mocks needed). */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EncounterModal from './EncounterModal.jsx';

const ENCOUNTERS = [
  { name: 'goblin-ambush', effectiveXP: 400 },
  { name: 'crag-mole-lair' },
];

const renderModal = (props = {}) => render(
  <EncounterModal
    isOpen
    onClose={vi.fn()}
    mode="load"
    onSave={vi.fn()}
    onLoad={vi.fn()}
    onDelete={vi.fn()}
    onRename={vi.fn()}
    encounters={ENCOUNTERS}
    loading={false}
    {...props}
  />
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EncounterModal — kit chrome (tranche 1)', () => {
  it('load-mode shell renders the .ct-modal* chrome with zero retired tokens', () => {
    const { container } = renderModal();
    const overlay = container.querySelector('.ct-modal-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay.querySelector('.ct-modal')).toBeInTheDocument();
    expect(container.querySelector('.ct-modal-header h3')).toHaveTextContent('Load Encounter');
    expect(container.querySelector('.ct-modal-close')).toBeInTheDocument();
    expect(container.querySelector('.ct-modal-body')).toBeInTheDocument();
    // Retired bespoke chrome tokens render nowhere.
    expect(container.querySelector('.encounter-modal-overlay')).toBeNull();
    expect(container.querySelector('.encounter-modal-header')).toBeNull();
    expect(container.querySelector('.encounter-modal-close')).toBeNull();
    expect(container.querySelector('.encounter-modal-body')).toBeNull();
    // The whole family's bespoke button tiers are gone.
    expect(container.querySelectorAll('.encounter-btn, [class*="encounter-btn-"]').length).toBe(0);
  });

  it('row actions ride the kit hierarchy (sm / sm-primary / sm-danger) with names and titles intact', () => {
    const { container } = renderModal();
    const rows = container.querySelectorAll('.encounter-list-item');
    expect(rows.length).toBe(2);
    const load = screen.getByRole('button', { name: 'Load "goblin-ambush"' });
    expect(load).toHaveClass('ct-btn', 'ct-btn-sm', 'ct-btn-primary');
    const rename = screen.getByRole('button', { name: 'Rename "goblin-ambush"' });
    expect(rename).toHaveClass('ct-btn', 'ct-btn-sm');
    expect(rename).toHaveAttribute('title', 'Rename "goblin-ambush"');
    const del = screen.getByRole('button', { name: 'Delete "goblin-ambush"' });
    expect(del).toHaveClass('ct-btn', 'ct-btn-sm', 'ct-btn-danger');
    expect(del).toHaveAttribute('title', 'Delete "goblin-ambush"');
  });

  it('empty pool renders .ct-empty-state with the unchanged copy; loading keeps its own face', () => {
    const { container } = renderModal({ encounters: [] });
    const empty = container.querySelector('.ct-empty-state');
    expect(empty).toHaveTextContent('No saved encounters yet.');
    expect(container.querySelector('.encounter-modal-empty')).toBeNull();
    renderModal({ encounters: [], loading: true });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('save mode fields and the commit button ride .ct-label/.ct-input/.ct-btn-primary inside the kept wrapper', () => {
    const { container } = renderModal({ mode: 'save' });
    const wrapper = container.querySelector('.encounter-modal-save');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper.querySelector('label')).toHaveClass('ct-label');
    expect(wrapper.querySelector('input')).toHaveClass('ct-input');
    const save = screen.getByRole('button', { name: /Save/i });
    expect(save).toHaveClass('ct-btn', 'ct-btn-primary');
    expect(save).toBeDisabled(); // name-gate law unchanged
  });

  it('backdrop guard follows the kit class: in-panel clicks stay inert, pure backdrop closes', () => {
    const onClose = vi.fn();
    const { container } = renderModal({ onClose });
    // A row's own Load button consumes its click through the kit guard:
    // bubbling PAST it must stay inert (the name span has no handler of its
    // own — it only proves the .ct-modal guard).
    fireEvent.click(screen.getByText('Goblin Ambush'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector('.ct-modal-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
