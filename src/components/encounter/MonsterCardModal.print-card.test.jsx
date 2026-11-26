// @maintained-by-ai 2026-11-25
/* Item 4 — the stat-block modal header earns a labeled Print Card verb that
 * opens the shared paper preview with the SAME monsters.json row the
 * interactive card runs. Boundary mocks identical to MonsterCardModal.test.jsx
 * (that file owns the stat-block render contract; this file owns ONLY the
 * handout lane): the portal reaches document.body, the sheet never writes,
 * and Escape closes the sheet without closing the monster modal. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../../services/ui/sanitize.js', () => ({
    sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
    rollExpression: vi.fn(() => ({ total: 7, rolls: [7], modifier: 0 })),
    rollExpressionDoubled: vi.fn(() => ({ total: 14, rolls: [7], modifier: 0 })),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
    default: vi.fn(() => ({
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollAttack: vi.fn(),
        rollDamage: vi.fn(),
        rollAbilityCheck: vi.fn(),
        rollSavingThrow: vi.fn(),
        rollSkillCheck: vi.fn(),
        rollInitiative: vi.fn(),
        quickRollPlayerSave: vi.fn(),
    })),
}));

vi.mock('../../common/Popup.jsx', () => ({ default: ({ children, onClick }) => <div data-testid="popup" onClick={onClick}>{children}</div> }));
vi.mock('../char-sheet/DiceRollResult.jsx', () => ({ default: () => <div data-testid="dice-roll-result">Dice Roll Result</div> }));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => types.join(', ')),
    getTargetFromAttacker: vi.fn(() => null),
    getCombatContext: vi.fn(() => Promise.resolve(null)),
    findCreatureByName: vi.fn(() => ({ name: 'Goblin', conditions: [] })),
    getResistanceNotice: vi.fn(() => null),
}));

vi.mock('../../services/shared/abilityLookup.js', () => ({
    getAbilitySaveModifier: vi.fn(() => 0),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => ({
        autoFailSaves: [],
        attackDisadvantageCount: 0,
        abilityCheckDisadvantage: false,
        strCheckDisadvantage: false,
        speedZero: false,
    })),
    combineAttackModes: vi.fn(() => 'normal'),
    CONDITIONS_THAT_CANNOT_ACT: new Set(),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
    computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
    getDistanceFeet: vi.fn(() => 5),
    getNearestPlacedItem: vi.fn(() => null),
    rangeToFeet: vi.fn((range) => parseInt(range, 10) || 30),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(() => Promise.resolve(null)),
    formatMapName: vi.fn((name) => name),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn((_campaign, key) => {
        if (key === 'targetEffects') return [];
        if (key === 'inspiringMovementNoOA') return false;
        if (key === 'remarkableAthleteNoOA') return false;
        return null;
    }),
    getRuntimeValue: vi.fn((_characterKey, _propertyName) => null),
}));

import MonsterCardModal from './MonsterCardModal.jsx';

const baseMonster = {
    name: 'Goblin',
    size: 'Small',
    type: 'humanoid',
    subtype: 'goblinoid',
    alignment: 'neutral evil',
    armor_class: 15,
    hit_points: 7,
    hit_dice: '2d6',
    initiative_details: '+2',
    speed: { walk: '30 ft.' },
    ability_scores: { str: 8, dex: 14, con: 10, int: 8, wis: 8, cha: 9 },
    ability_score_modifiers: { str: -1, dex: 2, con: 0, int: -1, wis: -1, cha: -1 },
    saving_throws: {},
    skills: {},
    senses: { darkvision: '60 ft.', passive_perception: 9 },
    languages: 'Common, Goblin',
    challenge_rating: '0.25',
    xp: 50,
    actions: [],
    traits: [],
    reactions: [],
    legendary_actions: [],
};

describe('MonsterCardModal — Print Card handout lane', () => {
  beforeEach(() => {
    cleanup();
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
  });

  const renderModal = () => render(
    <MonsterCardModal monster={baseMonster} onClose={vi.fn()} campaignName="test-campaign" />
  );

  it('the header carries a labeled Print Card verb marked .no-print', () => {
    renderModal();
    const btn = screen.getByRole('button', { name: 'Print stat card for Goblin' });
    expect(btn.className).toContain('no-print');
    expect(btn.textContent).toContain('Print Card');
  });

  it('pressing Print opens the paper portal with the monster from the modal data model', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Print stat card for Goblin' }));
    const portal = document.body.querySelector('.handout-preview-portal');
    expect(portal).not.toBeNull();
    const paper = portal.textContent.replace(/\u00a0/g, ' ');
    expect(paper).toContain('Monster Stat Card — Goblin');
    expect(paper).toContain('Small humanoid (goblinoid), neutral evil');
    expect(paper).toContain('Challenge 1/4 (50 XP)');
    // The handout lane itself writes nothing (the modal's mount-time
    // spells.json GETs for the chip index are pre-existing read traffic).
    const writes = (global.fetch.mock.calls || []).filter(([, options]) => (options?.method || 'GET') !== 'GET');
    expect(writes).toHaveLength(0);
  });

  it('Escape answers ONLY the preview — the monster modal survives the keystroke', () => {
    const onClose = vi.fn();
    render(
      <MonsterCardModal monster={baseMonster} onClose={onClose} campaignName="test-campaign" />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Print stat card for Goblin' }));
    fireEvent.keyDown(document.body, { key: 'Escape', bubbles: true });
    expect(document.body.querySelector('.handout-preview-portal')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });
});
