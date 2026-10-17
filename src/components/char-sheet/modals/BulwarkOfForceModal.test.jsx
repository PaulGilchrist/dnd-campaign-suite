// @maintained-by-ai
// BulwarkOfForceModal — thin wrapper over shared/CreatureSelectionModal.jsx.
// Caller/mount: CharActionModals.SecondaryModals.jsx (EnemySelectionModals) renders it
// from modalState.bulwarkOfForceModal { creatureTargets, maxTargets }.
// Seam owners (not exercised here):
//   - confirm handler: useCharActionsModalHandlers.js handleBulwarkOfForceConfirm →
//     services/automation/handlers/class-sorcerer/bulwarkOfForceHandler.js activateBulwarkOfForce
//     (own tests: bulwarkOfForceHandler.test.js, useCharActionsModalHandlers.*.test.js)
//   - +2 half-cover application: services/automation/contextBuilder-map.js, charSummaryCalc.js
//     (own tests: contextBuilder-map.test.js, MonsterCardModal.attack-logic.test.jsx)
//   - selection toggle, maxTargets cap internals, confirm gating, row/name/HP formats,
//     empty state, overlay pre-selection, skip/overlay: shared/CreatureSelectionModal.test.jsx
// This file pins only the wrapper contract: fixed labels, caller props forwarded by
// identity, no overlay/metamagic props fabricated, and click routing to caller callbacks.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import BulwarkOfForceModal from './BulwarkOfForceModal.jsx';

// Faithful minimal stub: mirrors the real modal's selection state, confirm guard
// (no call on empty selection), maxTargets cap, and callback wiring.
vi.mock('./shared/CreatureSelectionModal.jsx', async () => {
  const { useState } = await import('react');
  return {
    default: vi.fn(function CreatureSelectionModalStub(props) {
      const [selected, setSelected] = useState([]);
      const toggle = (name) =>
        setSelected((prev) =>
          prev.includes(name)
            ? prev.filter((n) => n !== name)
            : !props.maxTargets || prev.length < props.maxTargets
              ? [...prev, name]
              : prev
        );
      return (
        <div data-testid="creature-selection-modal">
          <div className="sp-header">
            <i className={`fa-solid ${props.icon}`} /> {props.title}
          </div>
          {props.description && <p>{props.description}</p>}
          <div className="secondary-target-list">
            {(props.targets || []).map((target) => {
              const name = target.name || target;
              const isSelected = selected.includes(name);
              const atMax =
                props.maxTargets &&
                typeof props.maxTargets === 'number' &&
                selected.length >= props.maxTargets &&
                !isSelected;
              return (
                <label key={name} className="secondary-target-row">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={atMax}
                    onChange={() => toggle(name)}
                  />
                  <strong>{name}</strong>
                </label>
              );
            })}
          </div>
          <div className="sp-actions">
            <button
              className="sp-roll-btn"
              type="button"
              disabled={selected.length === 0}
              onClick={() => selected.length > 0 && props.onConfirm(selected)}
            >
              <i className={`fa-solid ${props.confirmIcon || 'fa-crosshairs'}`} />{' '}
              {props.confirmLabel || 'Confirm'} ({selected.length})
            </button>
            <button className="sp-dismiss-btn" type="button" onClick={props.onSkip}>
              Skip
            </button>
          </div>
        </div>
      );
    }),
  };
});

import CreatureSelectionModal from './shared/CreatureSelectionModal.jsx';

const allies = [
  { name: 'Brennon', type: 'player', currentHp: 22, maxHp: 30 },
  { name: 'Krytha', type: 'player', currentHp: 8, maxHp: 26 },
  { name: 'Ysolde', type: 'player', currentHp: 31, maxHp: 31 },
];

// Fresh mocks + fresh targets array per call so identity assertions are meaningful.
function makeProps(overrides) {
  return {
    targets: allies.map((t) => ({ ...t })),
    maxTargets: 2,
    onConfirm: vi.fn(),
    onSkip: vi.fn(),
    ...(overrides || {}),
  };
}

function childProps() {
  const calls = vi.mocked(CreatureSelectionModal).mock.calls;
  expect(calls).toHaveLength(1);
  return calls[0][0];
}

afterEach(() => {
  // clearAllMocks would NOT strip mockResolvedValue — reset the module mock instead.
  vi.mocked(CreatureSelectionModal).mockReset();
});

describe('BulwarkOfForceModal', () => {
  it('binds fixed Half Cover labels and forwards caller props by identity, with no overlay/metamagic props', () => {
    const props = makeProps({ maxTargets: 3 });
    render(<BulwarkOfForceModal {...props} />);

    const child = childProps();
    expect(child.title).toBe('Bulwark of Force');
    expect(child.icon).toBe('fa-shield-halved');
    expect(child.description).toBe('Choose allies to grant Half Cover');
    expect(child.confirmLabel).toBe('Grant Half Cover');
    expect(child.confirmIcon).toBe('fa-shield-halved');
    expect(child.targets).toBe(props.targets);
    expect(child.maxTargets).toBe(3);
    expect(child.onConfirm).toBe(props.onConfirm);
    expect(child.onSkip).toBe(props.onSkip);
    // Bulwark mounts plain: overlay pre-selection and Heighten must not leak in.
    expect(child.campaignName).toBeUndefined();
    expect(child.attackerName).toBeUndefined();
    expect(child.defaultSelected).toBeUndefined();
    expect(child.metamagicHeighten).toBeUndefined();
  });

  it('routes confirm to the caller onConfirm with the exact selected names in click order', async () => {
    const props = makeProps();
    render(<BulwarkOfForceModal {...props} />);

    const confirmBtn = screen.getByRole('button', { name: /Grant Half Cover \(0\)/ });
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(props.onConfirm).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Krytha' }));
    expect(confirmBtn).toBeEnabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Brennon' }));

    fireEvent.click(screen.getByRole('button', { name: /Grant Half Cover \(2\)/ }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledWith(['Krytha', 'Brennon']);
    expect(props.onSkip).not.toHaveBeenCalled();
  });

  it.each([1, 2])('enforces forwarded maxTargets=%i: unselected rows lock at the cap and confirm carries only the selection', async (maxTargets) => {
    const props = makeProps({ maxTargets });
    render(<BulwarkOfForceModal {...props} />);

    const chosen = allies.slice(0, maxTargets).map((t) => t.name);
    const locked = allies.slice(maxTargets).map((t) => t.name);

    fireEvent.click(await screen.findByRole('checkbox', { name: chosen[0] }));
    chosen.slice(1).forEach((name) => fireEvent.click(screen.getByRole('checkbox', { name })));
    locked.forEach((name) => expect(screen.getByRole('checkbox', { name })).toBeDisabled());

    // A locked row stays inert even when clicked.
    fireEvent.click(screen.getByRole('checkbox', { name: locked[0] }));

    fireEvent.click(screen.getByRole('button', { name: `Grant Half Cover (${maxTargets})` }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledWith(chosen);
  });

  it('routes Skip to the caller onSkip and never touches onConfirm', async () => {
    const props = makeProps();
    render(<BulwarkOfForceModal {...props} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Skip' }));
    expect(props.onSkip).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });
});
