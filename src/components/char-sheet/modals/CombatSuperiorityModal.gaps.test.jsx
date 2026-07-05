// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CombatSuperiorityModal from './CombatSuperiorityModal.jsx';
import * as runtimeModule from '../../../hooks/runtime/useRuntimeState.js';

// ── Test fixtures ──

const basePayload = {
  allManeuvers: [
    { name: 'Trip Attack', actionType: 'attack_rider' },
    { name: 'Pushing Attack', actionType: 'movement' },
    { name: 'Disarming Attack', actionType: 'attack_rider' },
    { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
    { name: 'Evasive Footwork', actionType: 'reaction' },
    { name: 'Kicking Attack', actionType: 'skill_check' },
    { name: 'Rally', actionType: 'movement' },
    { name: 'Grasping Vine', actionType: 'grant_attack' },
  ],
  maxOptions: 3,
  knownManeuvers: [],
};

function makePayload(overrides = {}) {
  return { ...basePayload, ...overrides };
}

function makeProps(overrides = {}) {
  return {
    payload: makePayload(),
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

function renderModal(overrides = {}) {
  return render(<CombatSuperiorityModal {...makeProps(overrides)} />);
}

// ── Superiority dice logic ──

describe('CombatSuperiorityModal - superiority dice', () => {
  describe('hasSuperiorityDice logic', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('shows maneuver selection when playerStats is missing', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
          playerStats: undefined,
        }),
      });
      expect(screen.getByText(/Choose a maneuver to use/)).toBeInTheDocument();
    });

    it('shows maneuver selection when playerStats.name is missing', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
          playerStats: {},
        }),
      });
      expect(screen.getByText(/Choose a maneuver to use/)).toBeInTheDocument();
    });

    it('shows no dice message when getRuntimeValue returns 0', async () => {
      vi.spyOn(runtimeModule, 'getRuntimeValue').mockReturnValue(0);
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
          playerStats: { name: 'TestCharacter' },
        }),
      });
      await waitFor(() => {
        expect(screen.getByText(/No Superiority Dice remaining/)).toBeInTheDocument();
      });
    });

    it('shows no dice message when getRuntimeValue returns negative number', async () => {
      vi.spyOn(runtimeModule, 'getRuntimeValue').mockReturnValue(-1);
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
          playerStats: { name: 'TestCharacter' },
        }),
      });
      await waitFor(() => {
        expect(screen.getByText(/No Superiority Dice remaining/)).toBeInTheDocument();
      });
    });

    it('shows maneuver selection when getRuntimeValue returns positive number', () => {
      vi.spyOn(runtimeModule, 'getRuntimeValue').mockReturnValue(3);
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
          playerStats: { name: 'TestCharacter' },
        }),
      });
      expect(screen.getByText(/Choose a maneuver to use/)).toBeInTheDocument();
    });

    it('falls back to _trackedResources when getRuntimeValue returns null', () => {
      vi.spyOn(runtimeModule, 'getRuntimeValue').mockReturnValue(null);
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
          playerStats: {
            name: 'TestCharacter',
            _trackedResources: { superiorityDice: { current: 2 } },
          },
        }),
      });
      expect(screen.getByText(/Choose a maneuver to use/)).toBeInTheDocument();
    });

    it('shows no dice when _trackedResources.current is 0', async () => {
      vi.spyOn(runtimeModule, 'getRuntimeValue').mockReturnValue(null);
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
          playerStats: {
            name: 'TestCharacter',
            _trackedResources: { superiorityDice: { current: 0 } },
          },
        }),
      });
      await waitFor(() => {
        expect(screen.getByText(/No Superiority Dice remaining/)).toBeInTheDocument();
      });
    });

    it('shows no dice message when _trackedResources is missing', async () => {
      vi.spyOn(runtimeModule, 'getRuntimeValue').mockReturnValue(null);
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
          playerStats: { name: 'TestCharacter' },
        }),
      });
      await waitFor(() => {
        expect(screen.getByText(/No Superiority Dice remaining/)).toBeInTheDocument();
      });
    });

    it('shows no dice message when _trackedResources.superiorityDice is missing', async () => {
      vi.spyOn(runtimeModule, 'getRuntimeValue').mockReturnValue(null);
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
          playerStats: { name: 'TestCharacter', _trackedResources: {} },
        }),
      });
      await waitFor(() => {
        expect(screen.getByText(/No Superiority Dice remaining/)).toBeInTheDocument();
      });
    });

    it('calls getRuntimeValue with playerStats.name and superiorityDice', () => {
      const spy = vi.spyOn(runtimeModule, 'getRuntimeValue').mockReturnValue(1);
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
          playerStats: { name: 'TestCharacter' },
        }),
      });
      expect(spy).toHaveBeenCalledWith('TestCharacter', 'superiorityDice');
    });

    it('calls onClose when Close button is clicked in no dice state', async () => {
      const onClose = vi.fn();
      vi.spyOn(runtimeModule, 'getRuntimeValue').mockReturnValue(0);
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
          playerStats: { name: 'TestCharacter' },
        }),
        onClose,
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Close/ })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /Close/ }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not show no dice message when selectionMode is true', () => {
      vi.spyOn(runtimeModule, 'getRuntimeValue').mockReturnValue(0);
      renderModal({
        payload: makePayload({
          selectionMode: true,
          knownManeuvers: ['Ki-Fueled Attack'],
          playerStats: { name: 'TestCharacter' },
        }),
      });
      expect(screen.getByText(/Combat Superiority — Select Maneuvers/)).toBeInTheDocument();
    });
  });
});

// ── availableManeuvers override ──

describe('CombatSuperiorityModal - availableManeuvers override', () => {
  describe('availableManeuvers bypasses filtering', () => {
    it('uses availableManeuvers directly when provided and non-empty', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Trip Attack', actionType: 'attack_rider' },
          ],
          knownManeuvers: ['Available Only', 'Also Available'],
          availableManeuvers: [
            { name: 'Available Only', actionType: 'bonus_action' },
            { name: 'Also Available', actionType: 'reaction' },
          ],
          maxOptions: 3,
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Available Only')).toBeInTheDocument();
      expect(screen.getByText('Also Available')).toBeInTheDocument();
      expect(screen.queryByText('Ki-Fueled Attack')).not.toBeInTheDocument();
    });

    it('filters availableManeuvers by knownManeuvers in use mode but shows all in selection mode', () => {
      // Use mode: filters by knownManeuvers
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [],
          knownManeuvers: ['Ki-Fueled Attack'],
          availableManeuvers: [
            { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
            { name: 'Unknown Maneuver', actionType: 'reaction' },
          ],
          maxOptions: 3,
          selectionMode: false,
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Ki-Fueled Attack')).toBeInTheDocument();
      expect(screen.queryByText('Unknown Maneuver')).not.toBeInTheDocument();

      // Selection mode: shows all availableManeuvers regardless of knownManeuvers
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [],
          knownManeuvers: ['Ki-Fueled Attack'],
          availableManeuvers: [
            { name: 'Available A', actionType: 'bonus_action' },
            { name: 'Available B', actionType: 'reaction' },
          ],
          maxOptions: 3,
          selectionMode: true,
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Available A')).toBeInTheDocument();
      expect(screen.getByText('Available B')).toBeInTheDocument();
    });

    it('falls back to allManeuvers when availableManeuvers is an empty array', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
          availableManeuvers: [],
        }),
      });
      expect(screen.getByText('Ki-Fueled Attack')).toBeInTheDocument();
    });

    it('falls back to allManeuvers when availableManeuvers is null', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
          availableManeuvers: null,
        }),
      });
      expect(screen.getByText('Ki-Fueled Attack')).toBeInTheDocument();
    });

    it('falls back to allManeuvers when availableManeuvers is undefined', () => {
      renderModal({
        payload: makePayload({
          selectionMode: false,
          knownManeuvers: ['Ki-Fueled Attack'],
          availableManeuvers: undefined,
        }),
      });
      expect(screen.getByText('Ki-Fueled Attack')).toBeInTheDocument();
    });
  });
});

// ── Prompt mode with attackContext ──

describe('CombatSuperiorityModal - prompt mode with attackContext', () => {
  beforeEach(() => {
    vi.spyOn(runtimeModule, 'getRuntimeValue').mockReturnValue(1);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('attackContext prompt mode', () => {
    it('renders correct header in selection vs use mode with attackContext', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [{ name: 'A', actionType: 'bonus_action' }],
          knownManeuvers: [],
          maxOptions: 3,
          selectionMode: true,
          attackContext: { hit: true, weaponType: 'melee' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText(/Combat Superiority — Choose Maneuver/)).toBeInTheDocument();
    });

    it('renders "Use Maneuver" header in use mode with attackContext', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [{ name: 'Ki-Fueled Attack', actionType: 'bonus_action' }],
          knownManeuvers: ['Ki-Fueled Attack'],
          maxOptions: 3,
          selectionMode: false,
          attackContext: { hit: true, weaponType: 'melee' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText(/Combat Superiority — Use Maneuver/)).toBeInTheDocument();
    });

    it('filters maneuvers by trigger when attackContext is present and no availableManeuvers', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
            { name: 'Ki-Fueled Attack', actionType: 'bonus_action', trigger: 'any' },
            { name: 'Ranged Strike', actionType: 'attack_rider', trigger: 'weapon_attack_hit' },
          ],
          knownManeuvers: ['Trip Attack', 'Ki-Fueled Attack'],
          maxOptions: 3,
          selectionMode: false,
          attackContext: { hit: true, weaponType: 'melee', attackerName: 'TestChar' },
          playerStats: { name: 'TestChar' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Trip Attack')).toBeInTheDocument();
      expect(screen.getByText('Ki-Fueled Attack')).toBeInTheDocument();
      expect(screen.queryByText('Ranged Strike')).not.toBeInTheDocument();
    });

    it('filters by weapon_attack_hit trigger with ranged weapon', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Ranged Strike', actionType: 'attack_rider', trigger: 'weapon_attack_hit' },
            { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
          ],
          knownManeuvers: ['Ranged Strike', 'Trip Attack'],
          maxOptions: 3,
          selectionMode: false,
          attackContext: { hit: true, weaponType: 'ranged', attackerName: 'TestChar' },
          playerStats: { name: 'TestChar' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Ranged Strike')).toBeInTheDocument();
      expect(screen.queryByText('Trip Attack')).not.toBeInTheDocument();
    });

    it('filters by melee_weapon_attack_hit trigger without ranged', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Trip Attack', actionType: 'bonus_action', trigger: 'melee_weapon_attack_hit' },
            { name: 'Ranged Strike', actionType: 'bonus_action', trigger: 'attack_roll_miss' },
          ],
          knownManeuvers: ['Trip Attack', 'Ranged Strike'],
          maxOptions: 3,
          selectionMode: false,
          attackContext: { hit: true, weaponType: 'melee', attackerName: 'TestChar' },
          playerStats: { name: 'TestChar' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Trip Attack')).toBeInTheDocument();
      expect(screen.queryByText('Ranged Strike')).not.toBeInTheDocument();
    });

    it('filters by attack_roll_miss trigger', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Precision Attack', actionType: 'attack_rider', trigger: 'attack_roll_miss' },
            { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
          ],
          knownManeuvers: ['Precision Attack', 'Trip Attack'],
          maxOptions: 3,
          selectionMode: false,
          attackContext: { hit: false, attackerName: 'TestChar' },
          playerStats: { name: 'TestChar' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Precision Attack')).toBeInTheDocument();
      expect(screen.queryByText('Trip Attack')).not.toBeInTheDocument();
    });

    it('filters by melee_attack_miss trigger (target is player)', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Defensive Maneuver', actionType: 'reaction', trigger: 'melee_attack_miss' },
            { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
          ],
          knownManeuvers: ['Defensive Maneuver', 'Trip Attack'],
          maxOptions: 3,
          selectionMode: false,
          attackContext: { hit: false, weaponType: 'melee', targetName: 'TestChar' },
          playerStats: { name: 'TestChar' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Defensive Maneuver')).toBeInTheDocument();
      expect(screen.queryByText('Trip Attack')).not.toBeInTheDocument();
    });

    it('filters by melee_damage_taken trigger', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Dodge Maneuver', actionType: 'reaction', trigger: 'melee_damage_taken' },
            { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
          ],
          knownManeuvers: ['Dodge Maneuver', 'Trip Attack'],
          maxOptions: 3,
          selectionMode: false,
          attackContext: { weaponType: 'melee', targetName: 'TestChar' },
          playerStats: { name: 'TestChar' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Dodge Maneuver')).toBeInTheDocument();
      expect(screen.queryByText('Trip Attack')).not.toBeInTheDocument();
    });

    it('filters by melee_attack_straight_line trigger', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Flank Maneuver', actionType: 'bonus_action', trigger: 'melee_attack_straight_line' },
            { name: 'Trip Attack', actionType: 'bonus_action', trigger: 'attack_roll_miss' },
          ],
          knownManeuvers: ['Flank Maneuver', 'Trip Attack'],
          maxOptions: 3,
          selectionMode: false,
          attackContext: { weaponType: 'melee', attackerName: 'TestChar' },
          playerStats: { name: 'TestChar' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Flank Maneuver')).toBeInTheDocument();
      expect(screen.queryByText('Trip Attack')).not.toBeInTheDocument();
    });

    it('filters by replace_attack trigger', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Replace Strike', actionType: 'attack_rider', trigger: 'replace_attack' },
            { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
          ],
          knownManeuvers: ['Replace Strike', 'Trip Attack'],
          maxOptions: 3,
          selectionMode: false,
          attackContext: { replacingAttack: true, attackerName: 'TestChar' },
          playerStats: { name: 'TestChar' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Replace Strike')).toBeInTheDocument();
      expect(screen.queryByText('Trip Attack')).not.toBeInTheDocument();
    });

    it('includes maneuvers with no trigger in prompt mode', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Free Maneuver', actionType: 'bonus_action', trigger: null },
            { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
          ],
          knownManeuvers: ['Free Maneuver', 'Trip Attack'],
          maxOptions: 3,
          selectionMode: false,
          attackContext: { hit: true, weaponType: 'melee', attackerName: 'TestChar' },
          playerStats: { name: 'TestChar' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Free Maneuver')).toBeInTheDocument();
      expect(screen.getByText('Trip Attack')).toBeInTheDocument();
    });

    it('includes maneuvers with trigger "any" in prompt mode', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Universal Maneuver', actionType: 'bonus_action', trigger: 'any' },
            { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
          ],
          knownManeuvers: ['Universal Maneuver', 'Trip Attack'],
          maxOptions: 3,
          selectionMode: false,
          attackContext: { hit: true, weaponType: 'melee', attackerName: 'TestChar' },
          playerStats: { name: 'TestChar' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Universal Maneuver')).toBeInTheDocument();
      expect(screen.getByText('Trip Attack')).toBeInTheDocument();
    });

    it('excludes maneuver when attackerName does not match playerStats.name', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Other Character Maneuver', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
            { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
          ],
          knownManeuvers: ['Other Character Maneuver', 'Trip Attack'],
          maxOptions: 3,
          selectionMode: false,
          attackContext: { hit: true, weaponType: 'melee', attackerName: 'OtherChar' },
          playerStats: { name: 'TestChar' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.queryByText('Other Character Maneuver')).not.toBeInTheDocument();
      expect(screen.queryByText('Trip Attack')).not.toBeInTheDocument();
    });

    it('excludes maneuver when targetName does not match playerStats.name for target-based triggers', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Other Target Maneuver', actionType: 'reaction', trigger: 'melee_damage_taken' },
            { name: 'Trip Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
          ],
          knownManeuvers: ['Other Target Maneuver', 'Trip Attack'],
          maxOptions: 3,
          selectionMode: false,
          attackContext: { weaponType: 'melee', targetName: 'OtherChar' },
          playerStats: { name: 'TestChar' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.queryByText('Other Target Maneuver')).not.toBeInTheDocument();
      expect(screen.queryByText('Trip Attack')).not.toBeInTheDocument();
    });

    it('includes unarmed strike for melee_weapon_attack_hit', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Unarmed Maneuver', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit' },
          ],
          knownManeuvers: ['Unarmed Maneuver'],
          maxOptions: 3,
          selectionMode: false,
          attackContext: { hit: true, isUnarmedStrike: true, attackerName: 'TestChar' },
          playerStats: { name: 'TestChar' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Unarmed Maneuver')).toBeInTheDocument();
    });

    it('includes unarmed strike for weapon_attack_hit', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Unarmed Strike Maneuver', actionType: 'attack_rider', trigger: 'weapon_attack_hit' },
          ],
          knownManeuvers: ['Unarmed Strike Maneuver'],
          maxOptions: 3,
          selectionMode: false,
          attackContext: { hit: true, isUnarmedStrike: true, attackerName: 'TestChar' },
          playerStats: { name: 'TestChar' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Unarmed Strike Maneuver')).toBeInTheDocument();
    });
  });
});

// ── Prompt mode with skillContext ──

describe('CombatSuperiorityModal - prompt mode with skillContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('skillContext prompt mode', () => {
    it('renders correct headers and treats skillContext same as attackContext for isPromptMode', () => {
      // selection mode header
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [{ name: 'A', actionType: 'bonus_action' }],
          knownManeuvers: [],
          maxOptions: 3,
          selectionMode: true,
          skillContext: { skill: 'Athletics' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText(/Combat Superiority — Choose Maneuver/)).toBeInTheDocument();

      // use mode header
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [{ name: 'Ki-Fueled Attack', actionType: 'bonus_action' }],
          knownManeuvers: ['Ki-Fueled Attack'],
          maxOptions: 3,
          selectionMode: false,
          skillContext: { skill: 'Athletics' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText(/Combat Superiority — Use Maneuver/)).toBeInTheDocument();

      // treat as prompt mode (shows maneuvers with null trigger)
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [{ name: 'Free Maneuver', actionType: 'bonus_action', trigger: null }],
          knownManeuvers: ['Free Maneuver'],
          maxOptions: 3,
          selectionMode: false,
          skillContext: { skill: 'Athletics' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Free Maneuver')).toBeInTheDocument();
    });
  });
});

// ── lastAttack fallback ──

describe('CombatSuperiorityModal - lastAttack fallback', () => {
  beforeEach(() => {
    vi.spyOn(runtimeModule, 'getRuntimeValue').mockReturnValue(1);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('lastAttack fallback when attackContext is null', () => {
    it('constructs effectiveAttack from lastAttack when attackContext is null', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Trip Attack', actionType: 'bonus_action', trigger: 'melee_weapon_attack_hit' },
          ],
          knownManeuvers: ['Trip Attack'],
          maxOptions: 3,
          selectionMode: false,
          attackContext: null,
          lastAttack: { hit: true, weaponType: 'melee', attackerName: 'TestChar' },
          playerStats: { name: 'TestChar' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Trip Attack')).toBeInTheDocument();
    });

    it('defaults missing lastAttack fields to safe values', () => {
      // defaults weaponType to null, isCrit to false, isUnarmedStrike to false
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Any Trigger Maneuver', actionType: 'bonus_action', trigger: 'any' },
          ],
          knownManeuvers: ['Any Trigger Maneuver'],
          maxOptions: 3,
          selectionMode: false,
          attackContext: null,
          lastAttack: { hit: true, attackerName: 'TestChar' },
          playerStats: { name: 'TestChar' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Any Trigger Maneuver')).toBeInTheDocument();
    });

    it('defaults replacingAttack to false when missing', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Replace Attack Maneuver', actionType: 'attack_rider', trigger: 'replace_attack' },
          ],
          knownManeuvers: ['Replace Attack Maneuver'],
          maxOptions: 3,
          selectionMode: false,
          attackContext: null,
          lastAttack: { hit: true, attackerName: 'TestChar' },
          playerStats: { name: 'TestChar' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.queryByText('Replace Attack Maneuver')).not.toBeInTheDocument();
    });

    it('prefers attackContext over lastAttack when both are present', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Melee Maneuver', actionType: 'bonus_action', trigger: 'melee_weapon_attack_hit' },
            { name: 'Ranged Maneuver', actionType: 'bonus_action', trigger: 'attack_roll_miss' },
          ],
          knownManeuvers: ['Melee Maneuver', 'Ranged Maneuver'],
          maxOptions: 3,
          selectionMode: false,
          attackContext: { hit: true, weaponType: 'melee', attackerName: 'TestChar' },
          lastAttack: { hit: true, weaponType: 'ranged', attackerName: 'TestChar' },
          playerStats: { name: 'TestChar' },
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Melee Maneuver')).toBeInTheDocument();
      expect(screen.queryByText('Ranged Maneuver')).not.toBeInTheDocument();
    });

    it('falls back to knownManeuvers filtering when lastAttack is null', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
            { name: 'Unknown', actionType: 'reaction' },
          ],
          knownManeuvers: ['Ki-Fueled Attack'],
          maxOptions: 3,
          selectionMode: false,
          attackContext: null,
          lastAttack: null,
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Ki-Fueled Attack')).toBeInTheDocument();
      expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
    });

    it('falls back to knownManeuvers filtering when lastAttack has no useful data', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
            { name: 'Unknown', actionType: 'reaction' },
          ],
          knownManeuvers: ['Ki-Fueled Attack'],
          maxOptions: 3,
          selectionMode: false,
          attackContext: null,
          lastAttack: {},
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Ki-Fueled Attack')).toBeInTheDocument();
      expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
    });
  });
});

// ── onReopenSelection callback ──

describe('CombatSuperiorityModal - onReopenSelection', () => {
  describe('onReopenSelection callback behavior', () => {
    it('calls onReopenSelection when Manage Maneuvers is clicked and onReopenSelection exists', async () => {
      const onReopenSelection = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [{ name: 'Ki-Fueled Attack', actionType: 'bonus_action' }],
          knownManeuvers: ['Ki-Fueled Attack'],
          maxOptions: 3,
          selectionMode: false,
        }}
        onReopenSelection={onReopenSelection}
        onClose={onClose}
        onConfirm={vi.fn()}
      />);
      fireEvent.click(screen.getByRole('button', { name: /Manage Maneuvers/ }));
      await waitFor(() => {
        expect(onReopenSelection).toHaveBeenCalledTimes(1);
      });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('falls back to onConfirm when Manage Maneuvers is clicked and onReopenSelection does not exist', () => {
      const onConfirm = vi.fn();
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
            { name: 'Pushing Attack', actionType: 'movement' },
          ],
          knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
          maxOptions: 3,
          selectionMode: false,
        }}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />);
      fireEvent.click(screen.getByRole('button', { name: /Manage Maneuvers/ }));
      expect(onConfirm).toHaveBeenCalledWith(['Ki-Fueled Attack', 'Pushing Attack'], null);
    });

    it('logs error when onReopenSelection rejects', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
      const onReopenSelection = vi.fn().mockRejectedValue(new Error('fail'));
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [{ name: 'Ki-Fueled Attack', actionType: 'bonus_action' }],
          knownManeuvers: ['Ki-Fueled Attack'],
          maxOptions: 3,
          selectionMode: false,
        }}
        onReopenSelection={onReopenSelection}
        onConfirm={vi.fn()}
      />);
      const btn = screen.getByRole('button', { name: /Manage Maneuvers/ });
      fireEvent.click(btn);
      waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          '[CombatSuperiorityModal] Reopen selection failed:',
          expect.any(Error)
        );
      });
      consoleSpy.mockRestore();
    });
  });
});

// ── handleUseManeuver error path ──

describe('CombatSuperiorityModal - handleUseManeuver error', () => {
  describe('use maneuver error handling', () => {
    it('logs error, does not set applied state, and does not show result when onConfirm rejects', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
      const onConfirm = vi.fn().mockRejectedValue(new Error('use failed'));
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [{ name: 'Ki-Fueled Attack', actionType: 'bonus_action' }],
          knownManeuvers: ['Ki-Fueled Attack'],
          maxOptions: 3,
          selectionMode: false,
        }}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />);
      const radios = document.querySelectorAll('input[name="combatManeuver"]');
      fireEvent.click(radios[0]);
      fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          '[CombatSuperiorityModal] Use maneuver failed:',
          expect.any(Error)
        );
        expect(screen.queryByText('Done')).not.toBeInTheDocument();
      });
      consoleSpy.mockRestore();
    });
  });
});

// ── Selection mode initial state ──

describe('CombatSuperiorityModal - selection mode initial state', () => {
  describe('selection mode initial state from knownManeuvers', () => {
    it('pre-selects knownManeuvers in selection mode', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
            { name: 'Pushing Attack', actionType: 'movement' },
          ],
          knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
          maxOptions: 3,
          selectionMode: true,
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText(/2\/3 selected/)).toBeInTheDocument();
    });

    it('shows 0 selected when knownManeuvers is empty in selection mode', () => {
      renderModal({
        payload: makePayload({
          selectionMode: true,
          knownManeuvers: [],
        }),
      });
      expect(screen.getByText(/0\/3 selected/)).toBeInTheDocument();
    });
  });
});

// ── Maneuver description rendering ──

describe('CombatSuperiorityModal - maneuver descriptions', () => {
  describe('maneuver description rendering', () => {
    it('renders maneuver description in selection mode', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Trip Attack', actionType: 'attack_rider', description: 'Prone the target.' },
          ],
          knownManeuvers: [],
          maxOptions: 3,
          selectionMode: true,
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Trip Attack')).toBeInTheDocument();
      expect(screen.getByText('Prone the target.')).toBeInTheDocument();
    });

    it('renders maneuver description in use mode', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Ki-Fueled Attack', actionType: 'bonus_action', description: 'Add die to attack roll.' },
          ],
          knownManeuvers: ['Ki-Fueled Attack'],
          maxOptions: 3,
          selectionMode: false,
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      expect(screen.getByText('Ki-Fueled Attack')).toBeInTheDocument();
      expect(screen.getByText('Add die to attack roll.')).toBeInTheDocument();
    });
  });
});

// ── knownManeuvers seeded into selection state ──

describe('CombatSuperiorityModal - knownManeuvers in selection state', () => {
  describe('knownManeuvers pre-selected in state', () => {
    it('known maneuvers appear as checked in selection mode', () => {
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
            { name: 'Pushing Attack', actionType: 'movement' },
          ],
          knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
          maxOptions: 3,
          selectionMode: true,
        }}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />);
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes[0].checked).toBe(true);
      expect(checkboxes[1].checked).toBe(true);
    });

    it('confirm sends pre-selected known maneuvers', () => {
      const onConfirm = vi.fn();
      render(<CombatSuperiorityModal
        payload={{
          allManeuvers: [
            { name: 'Ki-Fueled Attack', actionType: 'bonus_action' },
            { name: 'Pushing Attack', actionType: 'movement' },
          ],
          knownManeuvers: ['Ki-Fueled Attack', 'Pushing Attack'],
          maxOptions: 3,
          selectionMode: true,
        }}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />);
      fireEvent.click(screen.getByRole('button', { name: /Confirm Selection/ }));
      expect(onConfirm).toHaveBeenCalledWith(['Ki-Fueled Attack', 'Pushing Attack'], null);
    });
  });
});
