// @maintained-by-ai
// XD-1116 improvement (2026-11-16): the target-arm select mirrors from the
// initiative card into the .mc-overlay stat-modal header so the full GM attack
// flow (arm → chip → Done) completes inside the modal. The modal renders the
// SAME shared TargetSelect component the card uses (shared file
// initiative/TargetSelect.jsx) and routes changes through the host-supplied
// onTargetChange — Initiative passes its own handleTargetChange, the exact
// handler bound to the card select (wiring pinned by
// Initiative.modal-target-arm.test.jsx). Pins here: modal renders
// select[aria-label="<Name> target"] reading the live combatSummary row,
// option filtering matches the card lane, changes route through the handler,
// SSE-echoed row updates repaint the select, the delegation picker is NEVER
// duplicated into the modal, and header clicks still close the overlay while
// arm-slot interactions do not.
// Harness mirrors MonsterCardModal.unarmed-attack-refusal.test.jsx (same mock
// family), with findCreatureByName implemented against the real creatures array.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn().mockResolvedValue(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  })),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ attackAdvantageCount: 0, attackDisadvantageCount: 0 })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures }, name) => (creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((range) => (typeof range === 'number' ? range : 5)),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn().mockResolvedValue(),
}));

// Away player — must NOT surface in the arm option list (isCreaturePresent).
const ROWS = () => ([
  { name: 'Goblin 1', type: 'npc', initiative: '8', targetName: null, concentration: null, conditions: [] },
  { name: 'Alice', type: 'player', initiative: '18', targetName: null, concentration: null, conditions: [] },
  { name: 'Bob', type: 'player', initiative: '12', away: true, targetName: null, concentration: null, conditions: [] },
]);

function renderModal(overrides = {}) {
  const m = makeMonster();
  const props = makeProps(m, { creatureName: 'Goblin 1', creatures: ROWS(), ...overrides });
  return render(<MonsterCardModal {...props} />);
}

const GM_PROPS = { onTargetChange: vi.fn(), isLocalhost: true };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('XD-1116 modal-header target-arm mirror', () => {
  it('initiative-lane host arms a select[aria-label="<Name> target"] reading the live combatSummary row, with card-parity option filtering', () => {
    renderModal({ ...GM_PROPS, creatures: [{ ...ROWS()[0], targetName: 'Alice' }, ...ROWS().slice(1)] });
    const select = document.querySelector('select[aria-label="Goblin 1 target"]');
    expect(select).toBeTruthy();
    // Mounted in the modal header (mc-header), before the close button.
    expect(select.closest('.mc-header')).toBeTruthy();
    expect(select.value).toBe('Alice');
    const values = Array.from(select.options).map(o => o.value);
    expect(values).toEqual(['', 'Alice']); // self excluded, away player excluded
  });

  it('changing the modal select routes through the host handler with (creatureName, targetName) — the card contract', () => {
    const onTargetChange = vi.fn();
    renderModal({ ...GM_PROPS, onTargetChange });
    fireEvent.change(document.querySelector('select[aria-label="Goblin 1 target"]'), { target: { value: 'Alice' } });
    expect(onTargetChange).toHaveBeenCalledWith('Goblin 1', 'Alice');
  });

  it('an SSE-echoed combatSummary row repaints the modal select (card→modal live sync face)', () => {
    const m = makeMonster();
    const onTargetChange = vi.fn();
    const view = render(<MonsterCardModal {...makeProps(m, { creatureName: 'Goblin 1', creatures: ROWS(), ...GM_PROPS, onTargetChange })} />);
    expect(view.container.querySelector('select[aria-label="Goblin 1 target"]').value).toBe('');
    // Echo adoption re-renders the host with the armed row (no local arm click).
    view.rerender(<MonsterCardModal {...makeProps(m, { creatureName: 'Goblin 1', creatures: [{ ...ROWS()[0], targetName: 'Alice' }, ...ROWS().slice(1)], ...GM_PROPS, onTargetChange })} />);
    expect(view.container.querySelector('select[aria-label="Goblin 1 target"]').value).toBe('Alice');
  });

  it('delegation picker is NEVER duplicated into the modal (card-only lane)', () => {
    renderModal(GM_PROPS);
    expect(document.querySelector('[aria-label="Assign who controls Goblin 1"]')).toBeNull();
  });

  it('header clicks still close the overlay; arm-slot clicks do not', () => {
    const onClose = vi.fn();
    const view = render(<MonsterCardModal {...makeProps(makeMonster(), { creatureName: 'Goblin 1', creatures: ROWS(), onClose, ...GM_PROPS })} />);
    fireEvent.click(view.container.querySelector('.mc-header-arm select'));
    fireEvent.click(view.container.querySelector('.mc-header-arm'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(view.container.querySelector('.mc-header-info'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('hosts without the initiative lane (no onTargetChange) render NO arm — EncounterBuilder/Map previews untouched', () => {
    renderModal({ creatures: ROWS() }); // makeProps default: no onTargetChange
    expect(document.querySelector('select[aria-label="Goblin 1 target"]')).toBeNull();
    expect(document.querySelector('.mc-header')).toBeTruthy(); // header still renders
  });

  it('visitor lane parity: uncontrolled monster renders no arm, delegated/summoned controller keeps it (verbatim card gate)', () => {
    renderModal({ ...GM_PROPS, isLocalhost: false, isPlayerSummoned: false });
    expect(document.querySelector('select[aria-label="Goblin 1 target"]')).toBeNull();
    renderModal({ ...GM_PROPS, isLocalhost: false, isPlayerSummoned: true });
    expect(document.querySelector('select[aria-label="Goblin 1 target"]')).toBeTruthy();
  });
});
