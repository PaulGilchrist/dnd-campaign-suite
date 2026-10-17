// CoronaEnemySelectionModal — thin wrapper over shared/CreatureSelectionModal.jsx.
// Caller/mount: CharActionModals.SecondaryModals.jsx (EnemySelectionModals) renders it
// from modalState.coronaEnemySelectionModal { creatureTargets }.
// Seam owners (not exercised here):
//   - confirm handler: useCharActionsModalHandlers.js handleCoronaEnemySelectionConfirm →
//     services/automation/handlers/class-cleric-paladin/coronaOfLightHandler.js activateCoronaOfLight
//     (own tests: useCharActionsModalHandlers.areaEffects.test.js, coronaOfLightHandler.test.js)
//   - aura disadvantage application: services/combat/auras/coronaAuraUtils.js via
//     contextBuilder-map.js / aoeService.js / handleNpcSaveDamage (own tests: aoeService.test.js,
//     handleNpcSaveDamage.*.test.js); badge lane: ConditionEffectBadges.no-oa-speedy.test.jsx
//   - selection toggle, confirm guard (no call on empty selection), row/name/HP formats,
//     count label, empty state, overlay pre-selection, skip/overlay: shared/CreatureSelectionModal.test.jsx
// This file pins only the wrapper contract: fixed Corona labels, caller props forwarded by
// identity, empty/undefined props forwarded verbatim (no fabricated fallbacks), no
// maxTargets/overlay/metamagic props, and click routing with the exact selected names.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import CoronaEnemySelectionModal from './CoronaEnemySelectionModal.jsx';

// Faithful minimal stub: mirrors the real modal's selection state, confirm guard
// (no call on empty selection), selected-count label suffix, and callback wiring —
// onConfirm receives the array of selected names, never undefined.
vi.mock('./shared/CreatureSelectionModal.jsx', async () => {
  const { useState } = await import('react');
  return {
    default: vi.fn(function CreatureSelectionModalStub(props) {
      const [selected, setSelected] = useState([]);
      const toggle = (name) =>
        setSelected((prev) =>
          prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
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
              return (
                <label key={name} className="secondary-target-row">
                  <input
                    type="checkbox"
                    checked={isSelected}
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

// Fresh mocks + fresh targets array per call so identity assertions are meaningful.
function makeProps(overrides) {
  return {
    creatureTargets: [
      { name: 'Goblin A', type: 'enemy', currentHp: 5, maxHp: 10 },
      { name: 'Goblin B', type: 'enemy', currentHp: 3, maxHp: 10 },
      { name: 'Player Character', type: 'player', currentHp: 20, maxHp: 30 },
    ],
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

describe('CoronaEnemySelectionModal', () => {
  it('binds fixed Corona of Light labels and forwards caller props by identity, with no maxTargets/overlay/metamagic props', () => {
    const props = makeProps();
    render(<CoronaEnemySelectionModal {...props} />);

    const child = childProps();
    expect(child.title).toBe('Corona of Light');
    expect(child.icon).toBe('fa-sun');
    expect(child.description).toBe(
      'Select which creatures are enemies of the caster. Enemies in the bright light have Disadvantage on saving throws against Fire and Radiant damage:'
    );
    expect(child.confirmLabel).toBe('Activate Corona');
    expect(child.confirmIcon).toBe('fa-sun');
    expect(child.targets).toBe(props.creatureTargets);
    expect(child.onConfirm).toBe(props.onConfirm);
    expect(child.onSkip).toBe(props.onSkip);
    // Corona mounts plain: caps, overlay pre-selection, range and Heighten must not leak in.
    expect(child.maxTargets).toBeUndefined();
    expect(child.defaultSelected).toBeUndefined();
    expect(child.campaignName).toBeUndefined();
    expect(child.attackerName).toBeUndefined();
    expect(child.rangeFt).toBeUndefined();
    expect(child.metamagicHeighten).toBeUndefined();
  });

  it('forwards empty targets and undefined callbacks verbatim — no fabricated fallbacks', () => {
    const emptyTargets = [];
    render(
      <CoronaEnemySelectionModal
        creatureTargets={emptyTargets}
        onConfirm={undefined}
        onSkip={undefined}
      />
    );

    const child = childProps();
    expect(child.targets).toBe(emptyTargets);
    expect(child.onConfirm).toBeUndefined();
    expect(child.onSkip).toBeUndefined();
  });

  it('routes confirm to the caller onConfirm with the exact selected names in click order', async () => {
    const props = makeProps();
    render(<CoronaEnemySelectionModal {...props} />);

    const confirmBtn = screen.getByRole('button', { name: /Activate Corona \(0\)/ });
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(props.onConfirm).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Goblin A' }));
    expect(confirmBtn).toBeEnabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Player Character' }));

    fireEvent.click(screen.getByRole('button', { name: /Activate Corona \(2\)/ }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledWith(['Goblin A', 'Player Character']);
    expect(props.onSkip).not.toHaveBeenCalled();
  });

  it('routes Skip to the caller onSkip and never touches onConfirm', async () => {
    const props = makeProps();
    render(<CoronaEnemySelectionModal {...props} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Skip' }));
    expect(props.onSkip).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });
});
