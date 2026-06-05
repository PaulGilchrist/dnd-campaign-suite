import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharClassFeatures from './CharClassFeatures.jsx';

vi.mock('../../../services/storage.js', () => ({
  default: {
    getProperty: vi.fn(),
    setProperty: vi.fn(),
   },
}));

vi.mock('../../../hooks/useRuntimeState.js', () => {
  const listeners = new Map();
  return {
    getRuntimeValue: vi.fn((_characterKey, _propertyName) => {
      return null;
      }),
    setRuntimeValue: vi.fn((characterKey, _propertyName, _value, _campaignName) => {
        // Notify listeners
      const key = characterKey;
      if (listeners.has(key)) {
        listeners.get(key).forEach(fn => fn());
        }
      }),
    useRuntimeValue: vi.fn((_characterKey, _propertyName) => {
      return null;
      }),
    addStorageChangeListener: vi.fn(() => () => {}),
    setRuntimeObject: vi.fn(),
    setRuntimeBatch: vi.fn(),
    clearRuntimeState: vi.fn(),
  };
});

vi.mock('../../common/HiddenInput.jsx', () => ({
  default: vi.fn(({ value, showInput, handleInputToggle, handleValueChange }) => {
    if (showInput) {
      return (
           <input
           data-testid="hidden-input"
           type="number"
           value={value}
           onChange={(e) => handleValueChange(e.target.value)}
           onBlur={handleInputToggle}
            />
         );
       }
    return <span data-testid="hidden-value">{value}</span>;
      }),
}));

vi.mock('../../../services/classRules.js', () => ({
  default: {
    getDruidMaxWildShapeChallengeRating: vi.fn(),
    getDruidWildShapeUses: vi.fn(),
    getDruidBeastKnownForms: vi.fn(),
    getDruidBeastFlySpeed: vi.fn(),
    getHighestSubclassLevel: vi.fn(),
    getBardFeatures: vi.fn((playerStats) => {
      const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
      const bardicDie = classLevel?.class_specific?.bardic_inspiration_die || 0;
      const songOfRestDie = classLevel?.class_specific?.song_of_rest_die ?? null;
      const magicalSecrets = classLevel?.class_specific?.magical_secrets_max_5 ?? null;
      let subclassMagicalSecrets = 0;
      if (playerStats.class?.subclass?.name === 'Lore' && playerStats.level > 2) {
        const highestSubclassLevel = classRules.getHighestSubclassLevel(playerStats);
        subclassMagicalSecrets = highestSubclassLevel?.subclass_specific?.additional_magical_secrets_max_lvl || 0;
       }
      return { bardicDie, songOfRestDie, magicalSecrets, subclassMagicalSecrets };
     }),
    getClericFeatures: vi.fn((playerStats) => {
      const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
      const maxChannelDivinity = classLevel?.class_specific?.channel_divinity_charges || 0;
      const destroyUndeadCR = classLevel?.class_specific?.destroy_undead_cr || null;
      return { maxChannelDivinity, destroyUndeadCR };
     }),
    getDruidFeatures: vi.fn((playerStats) => {
      const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
      const classSpecific = classLevel?.class_specific;
      const maxWildShapeChallengeRating = classRules.getDruidMaxWildShapeChallengeRating(playerStats);
      const maxWildShapeUses = 2;
      const beastKnownForms = 0;
      let wildShapeLimitations = 'walk only (no swim or fly)';
      if (classSpecific?.wild_shape_fly) {
        wildShapeLimitations = 'walk, swim, or fly';
       } else if (classSpecific?.wild_shape_swim) {
        wildShapeLimitations = 'walk or swim only (no fly)';
       }
      return { maxWildShapeUses, maxWildShapeChallengeRating, beastKnownForms, wildShapeLimitations };
     }),
    getPaladinFeatures: vi.fn((playerStats) => {
      const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
      const classSpecific = classLevel?.class_specific;
      const maxChannelDivinity = classSpecific?.channel_divinity_charges || 0;
      const auraRange = classSpecific?.aura_range || null;
      const extraAttacks = playerStats.level > 4 ? 1 : 0;
      return { maxChannelDivinity, auraRange, extraAttacks };
     }),
    getSorcererFeatures: vi.fn((playerStats) => {
      const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
      const classSpecific = classLevel?.class_specific;
      const maxSorceryPoints = classSpecific?.sorcery_points || 0;
      const metamagicKnown = classSpecific?.metamagic_known || 0;
      const creatingSpellSlotCosts = classSpecific?.creating_spell_slots
         ? classSpecific.creating_spell_slots.map(slot => slot.sorcery_point_cost)
         : [];
      return { maxSorceryPoints, metamagicKnown, creatingSpellSlotCosts };
     }),
    getWarlockFeatures: vi.fn((playerStats) => {
      const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
      const classSpecific = classLevel?.class_specific;
      const invocationsKnown = classSpecific?.invocations_known || 0;
      const hasArcanum = playerStats.level > 10;
      const arcanumLevels = hasArcanum ? {
        level6: classSpecific?.mystic_arcanum_level_6 || 0,
        level7: classSpecific?.mystic_arcanum_level_7 || 0,
        level8: classSpecific?.mystic_arcanum_level_8 || 0,
        level9: classSpecific?.mystic_arcanum_level_9 || 0
       } : {
        level6: 0,
        level7: 0,
        level8: 0,
        level9: 0
        };
       const arcanums = playerStats.class?.arcanums || [];
       return { invocationsKnown, hasArcanum, arcanumLevels, arcanums, invocations: ['Agonizing Blast'], pactBoon: 'Pact of the Blade' };
       }),
     getWizardFeatures: vi.fn((playerStats) => {
       const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
      const arcaneRecoveryLevels = classLevel?.class_specific?.arcane_recovery_levels || 0;
      return { arcaneRecoveryLevels, showWizardFeatures: true };
     }),
     getMonkFeatures: vi.fn(() => {
       return {
         martialArtsDie: 4,
         unarmoredMovementIncrease: 0,
         maxFocusPoints: 3,
         wisdomBonus: 0
        };
        }),
      getRogueFeatures: vi.fn((playerStats) => {
      const sneakAttack = { dice_count: 0, dice_value: 6 };
      const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
      if (classLevel?.class_specific?.sneak_attack) {
        sneakAttack.dice_count = classLevel.class_specific.sneak_attack.dice_count || 0;
        sneakAttack.dice_value = classLevel.class_specific.sneak_attack.dice_value || 6;
       }
      const expertise = playerStats.class?.expertise || [];
      return { sneakAttack, expertise };
     }),
    getRangerFeatures: vi.fn((playerStats) => {
      const favoredEnemies = 0;
      const extraAttacks = playerStats.level > 4 ? 1 : 0;
      return { favoredEnemies, extraAttacks };
      }),
     },
}));

vi.mock('../../../services/classRules2024.js', () => ({
  default: {
    getDruidMaxWildShapeChallengeRating: vi.fn((playerStats) => {
      const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
      let maxWildShapeChallengeRating = classLevel?.beast_max_cr || 0;
      if (playerStats.class.major && playerStats.class.major.name === 'Moon' && playerStats.level > 1) {
        maxWildShapeChallengeRating = 1;
        if (playerStats.level > 5) {
          maxWildShapeChallengeRating = Math.floor(playerStats.level / 3);
         }
       }
      return maxWildShapeChallengeRating;
     }),
    getDruidWildShapeUses: vi.fn((playerStats) => {
      const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
      return classLevel?.wild_shape || 0;
     }),
    getDruidBeastKnownForms: vi.fn((playerStats) => {
      const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
      return classLevel?.beast_known_forms || 0;
     }),
    getDruidBeastFlySpeed: vi.fn((playerStats) => {
      const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
      return classLevel?.beast_fly_speed === 'Yes';
     }),
    getFavoredEnemy: vi.fn((playerStats) => {
      const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
      if (!classLevel) return 0;
      return classLevel.favored_enemy || 0;
     }),
    getEldritchInvocations: vi.fn((playerStats) => {
      const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
      if (!classLevel) return 0;
      return classLevel.eldritch_invocations || 0;
     }),
    getMartialArtsDie: vi.fn((playerStats) => {
      const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
      if (!classLevel) return 4;
      return classLevel.martial_arts_die || 4;
     }),
    getUnarmoredMovementIncrease: vi.fn((playerStats) => {
      const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
      if (!classLevel) return 0;
      return classLevel.unarmored_movement_increase || 0;
     }),
    getFocusPoints: vi.fn((playerStats) => {
      const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
      if (!classLevel) return 0;
      return classLevel.focus_points || 0;
     }),
    getClericFeatures: vi.fn((playerStats) => {
      const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
      const maxChannelDivinity = classLevel?.channel_divinity || 0;
      return {
        maxChannelDivinity,
        destroyUndeadCR: null
       };
     }),
     getDruidFeatures: vi.fn((playerStats) => {
      const maxWildShapeChallengeRating = classRules2024.getDruidMaxWildShapeChallengeRating(playerStats);
      const maxWildShapeUses = classRules2024.getDruidWildShapeUses(playerStats);
      const beastKnownForms = classRules2024.getDruidBeastKnownForms(playerStats);
      const canFly = classRules2024.getDruidBeastFlySpeed(playerStats);
      const wildShapeLimitations = canFly ? 'walk, swim, or fly' : 'walk or swim only (no fly)';
      return {
        maxWildShapeUses,
        maxWildShapeChallengeRating,
        beastKnownForms,
        wildShapeLimitations
       };
     }),
     getPaladinFeatures: vi.fn((playerStats) => {
      const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
      const maxChannelDivinity = classLevel?.channel_divinity || 0;
      const extraAttacks = playerStats.level > 4 ? 1 : 0;
      return {
        maxChannelDivinity,
        auraRange: null,
        extraAttacks
       };
     }),
     getSorcererFeatures: vi.fn((playerStats) => {
      const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
      const maxSorceryPoints = classLevel?.sorcery_points || 0;
      let metamagicKnown = 0;
      if (playerStats.level >= 17) {
        metamagicKnown = 6;
       } else if (playerStats.level >= 10) {
        metamagicKnown = 4;
       } else if (playerStats.level >= 3) {
        metamagicKnown = 2;
       }
      return {
        maxSorceryPoints,
        metamagicKnown,
        creatingSpellSlotCosts: []
       };
     }),
     getWarlockFeatures: vi.fn((playerStats) => {
      const invocationsKnown = classRules2024.getEldritchInvocations(playerStats);
      return {
        invocationsKnown,
        hasArcanum: false,
        arcanumLevels: null,
        arcanums: playerStats.class?.eldritchInvocations || [],
        pactBoon: playerStats.class?.pactBoon || null,
        invocations: playerStats.class?.invocations || []
       };
     }),
      getWizardFeatures: vi.fn(() => {
       return {
         showWizardFeatures: false
        };
      }),
        getMonkFeatures: vi.fn((playerStats) => {
        const martialArtsDie = classRules2024.getMartialArtsDie(playerStats);
        const unarmoredMovementIncrease = classRules2024.getUnarmoredMovementIncrease(playerStats);
         const maxFocusPoints = classRules2024.getFocusPoints(playerStats);
        return {
         martialArtsDie,
         unarmoredMovementIncrease,
         maxFocusPoints,
         wisdomBonus: 0
        };
      }),
     getRangerFeatures: vi.fn((playerStats) => {
      const favoredEnemies = classRules2024.getFavoredEnemy(playerStats);
      const extraAttacks = playerStats.level > 4 ? 1 : 0;
      return {
        favoredEnemies,
        extraAttacks
       };
     }),
     getRogueFeatures: vi.fn((playerStats) => {
      const sneakAttack = { dice_count: 0, dice_value: 6 };
      const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
      if (classLevel) {
        sneakAttack.dice_count = classLevel.sneak_attack_num_d6 || 0;
       }
      const expertise = playerStats.class?.expertise || [];
      return { sneakAttack, expertise };
     }),
     getBardFeatures: vi.fn((playerStats) => {
      const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
      const bardicDie = classLevel?.bardic_die || 0;
      return {
        bardicDie,
        songOfRestDie: null,
        magicalSecrets: null,
        subclassMagicalSecrets: 0
       };
      }),
   },
}));

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import storage from '../../../services/storage.js';
import classRules from '../../../services/classRules.js';
import classRules2024 from '../../../services/classRules2024.js';

function toggleFirstClickChangeAndSet(value) {
  fireEvent.click(document.querySelector('.clickable'));
  const input = screen.getByTestId('hidden-input');
  fireEvent.change(input, { target: { value } });
}

/* -- Barbarian -- */
describe('Barbarian', () => {
  const mockStats5e = {
    name: 'Barb5e',
    level: 5,
    rules: '5e',
    class: {
      name: 'Barbarian',
      class_levels: Array.from({ length: 5 }, (_, i) => ({
        level: i + 1,
        class_specific: { rage_count: i >= 4 ? 3 : 2, rage_damage_bonus: 2, brutal_critical_dice: 0, unarmored_movement: i >= 4 ? 10 : 0 },
      })),
     },
    };
  const mockStats2024 = {
    name: 'Barb2024',
    level: 5,
    rules: '2024',
    class: {
      name: 'Barbarian',
      class_levels: Array.from({ length: 5 }, (_, i) => ({ level: i + 1, rages: 4, extra_attacks: 1, rage_damage: 2, weapon_mastery: 'Slashing' })),
     },
    };
  beforeEach(() => { vi.clearAllMocks(); getRuntimeValue.mockReturnValue(null); });

  it('renders barbarian features (5e)', () => {
    render(<CharClassFeatures playerStats={mockStats5e} />);
    expect(screen.getByText(/Extra Attacks:/)).toBeInTheDocument();
    expect(screen.getByText(/Rage Points:/)).toBeInTheDocument();
    expect(screen.getByText(/Rage Damage Bonus:/)).toBeInTheDocument();
    expect(screen.getByText(/Weapon Mastery:/)).toBeInTheDocument();
     });

  it('renders barbarian features (2024)', () => {
    render(<CharClassFeatures playerStats={mockStats2024} />);
    expect(screen.getByText(/Extra Attacks:/)).toBeInTheDocument();
    expect(screen.getByText(/Rage Points:/)).toBeInTheDocument();
    expect(screen.getByText(/Rage Damage Bonus:/)).toBeInTheDocument();
    expect(screen.getByText(/Weapon Mastery:/)).toBeInTheDocument();
     });

  it('shows extra attacks = 1 for 5e at level 5', () => {
    render(<CharClassFeatures playerStats={mockStats5e} />);
    expect(screen.getByText(/Extra Attacks:/).parentElement.textContent).toContain('1');
     });

  it('shows extra attacks = 0 for 5e at level 4', () => {
    const stats = { ...mockStats5e, level: 4 };
    render(<CharClassFeatures playerStats={stats} />);
    expect(screen.getByText(/Extra Attacks:/).parentElement.textContent).toContain('0');
     });

  it('shows rage count from class_specific.rage_count (5e)', () => {
    render(<CharClassFeatures playerStats={mockStats5e} />);
    expect(screen.getByText(/\(max\/cur\)/)).toBeInTheDocument();
     });

  it('shows rage damage from class_specific.rage_damage_bonus (5e)', () => {
    render(<CharClassFeatures playerStats={mockStats5e} />);
    expect(screen.getByText(/Rage Damage Bonus:/).parentElement.textContent).toContain('2');
     });

  it('shows N/A for weapon mastery in 5e', () => {
    render(<CharClassFeatures playerStats={mockStats5e} />);
    expect(screen.getByText(/Weapon Mastery:/).parentElement.textContent).toContain('N/A');
     });

  it('handles weapon mastery undefined (2024)', () => {
    const stats = { ...mockStats2024, level: 1, class: { name: 'Barbarian', class_levels: [{ level: 1, rages: 2, extra_attacks: 0, rage_damage: 2, weapon_mastery: undefined }] } };
    render(<CharClassFeatures playerStats={stats} />);
    expect(screen.getByText(/Weapon Mastery:/).parentElement.textContent).toContain('N/A');
     });

  it('shows max/cur label (2024)', () => {
    render(<CharClassFeatures playerStats={mockStats2024} />);
    expect(screen.getByText(/\(max\/cur\)/)).toBeInTheDocument();
     });

  it('persists rage points to storage', () => {
    render(<CharClassFeatures playerStats={mockStats2024} />);
    toggleFirstClickChangeAndSet('3');
    expect(setRuntimeValue).toHaveBeenCalledWith('Barb2024', 'ragePoints', '3', undefined);
     });
});

/* -- Bard -- */
describe('Bard', () => {
  const mockStats = {
    name: 'Bard',
    level: 5,
    rules: '5e',
    abilities: [{ name: 'Charisma', bonus: 3 }],
    class: {
      name: 'Bard',
      expertise: ['Performance', 'Persuasion'],
      class_levels: Array.from({ length: 5 }, (_, i) => ({ level: i + 1, class_specific: { bardic_inspiration_die: 6, song_of_rest_die: 8, magical_secrets_max_5: 1 } })),
     },
    };
  const mockStats2024 = {
    name: 'Bard2024',
    level: 5,
    rules: '2024',
    abilities: [{ name: 'Charisma', bonus: 3 }],
    class: { name: 'Bard', class_levels: Array(5).fill({ bardic_die: 8 }) },
    };
  beforeEach(() => { vi.clearAllMocks(); getRuntimeValue.mockReturnValue(null); });

  it('renders bardic inspiration', () => {
    render(<CharClassFeatures playerStats={mockStats} />);
    expect(screen.getByText(/Bardic Inspiration Die:/)).toBeInTheDocument();
     });

  it('shows song of rest for 5e', () => {
    render(<CharClassFeatures playerStats={mockStats} />);
    expect(screen.getByText(/Song of Rest Die:/)).toBeInTheDocument();
     });

  it('does not show 5e-only features for 2024', () => {
    render(<CharClassFeatures playerStats={mockStats2024} />);
    expect(screen.queryByText(/Song of Rest Die:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Magical Secrets:/)).not.toBeInTheDocument();
     });

  it('persists bardic inspiration to storage', () => {
    render(<CharClassFeatures playerStats={mockStats} />);
    toggleFirstClickChangeAndSet('1');
    expect(setRuntimeValue).toHaveBeenCalledWith('Bard', 'bardicInspirationUses', '1', undefined);
     });
});

/* -- Cleric -- */
describe('Cleric', () => {
  const mockStats = {
    name: 'Cleric',
    level: 5,
    rules: '5e',
    class: {
      name: 'Cleric',
      class_levels: Array.from({ length: 5 }, (_, i) => ({ level: i + 1, class_specific: { channel_divinity_charges: 2, destroy_undead_cr: '1/2' } })),
     },
    };
  beforeEach(() => { vi.clearAllMocks(); getRuntimeValue.mockReturnValue(null); });

  it('renders channel divinity (5e)', () => {
    render(<CharClassFeatures playerStats={mockStats} />);
    expect(screen.getByText(/Channel Divinity Charges:/)).toBeInTheDocument();
    expect(screen.getByText(/Destroy Undead Challenge Rating:/)).toBeInTheDocument();
     });

  it('does not show destroy undead for 2024', () => {
    const stats = { ...mockStats, rules: '2024', class: { name: 'Cleric', class_levels: Array(5).fill({ channel_divinity: 2 }) } };
    render(<CharClassFeatures playerStats={stats} />);
    expect(screen.queryByText(/Destroy Undead Challenge Rating:/)).not.toBeInTheDocument();
     });

  it('persists channel divinity to storage', () => {
    render(<CharClassFeatures playerStats={mockStats} />);
    toggleFirstClickChangeAndSet('1');
    expect(setRuntimeValue).toHaveBeenCalledWith('Cleric', 'channelDivinityCharges', '1', undefined);
     });
});

/* -- Druid -- */
describe('Druid', () => {
  const mockStats5e = {
    name: 'Druid',
    level: 2,
    rules: '5e',
    class: {
      name: 'Druid',
      class_levels: [{}],
     },
    };
  const mockStats2024 = {
    name: 'Druid2024',
    level: 2,
    rules: '2024',
    class: { name: 'Druid' },
    };
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getProperty.mockReturnValue(null);
    classRules.getDruidMaxWildShapeChallengeRating.mockReturnValue(1);
    classRules2024.getDruidMaxWildShapeChallengeRating.mockReturnValue(1);
    classRules2024.getDruidWildShapeUses.mockReturnValue(2);
    classRules2024.getDruidBeastKnownForms.mockReturnValue(3);
    classRules2024.getDruidBeastFlySpeed.mockReturnValue(true);
   });

  it('does not render at level 1', () => {
    const stats = { ...mockStats5e, level: 1 };
    const { container } = render(<CharClassFeatures playerStats={stats} />);
    expect(screen.queryByText(/Wild Shape Uses:/)).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="char-class-druid"]')).toBeNull();
     });

  it('renders druid features (5e)', () => {
    render(<CharClassFeatures playerStats={mockStats5e} />);
    expect(screen.getByText(/Wild Shape Uses:/)).toBeInTheDocument();
    expect(screen.getByText(/Wild Shape Limitations:/)).toBeInTheDocument();
     });

  it('renders beast forms known for 2024', () => {
    render(<CharClassFeatures playerStats={mockStats2024} />);
    expect(screen.getByText(/Beast Forms Known:/)).toBeInTheDocument();
     });

  it('persists wild shape uses to storage', () => {
    render(<CharClassFeatures playerStats={mockStats5e} />);
    toggleFirstClickChangeAndSet('1');
    expect(setRuntimeValue).toHaveBeenCalledWith('Druid', 'wildShapeUses', '1', undefined);
     });
});

/* -- Fighter -- */
describe('Fighter', () => {
  const mockStats = {
    name: 'Fighter',
    level: 5,
    class: {
      name: 'Fighter',
      fightingStyles: ['Defense'],
      class_levels: Array.from({ length: 5 }, (_, i) => ({ level: i + 1, extra_attacks: 1, second_wind: 2, weapon_mastery: 'Slashing' })),
     },
    };
  beforeEach(() => { vi.clearAllMocks(); getRuntimeValue.mockReturnValue(null); });

  it('renders fighter features', () => {
    render(<CharClassFeatures playerStats={mockStats} />);
    expect(screen.getByText(/Fighting Styles:/)).toBeInTheDocument();
    expect(screen.getByText(/Second Wind:/)).toBeInTheDocument();
     });

  it('persists second wind to storage', () => {
    render(<CharClassFeatures playerStats={mockStats} />);
    const clickable = document.querySelector('.clickable');
    fireEvent.click(clickable);
    const input = screen.getByTestId('hidden-input');
    fireEvent.change(input, { target: { value: '0' } });
    expect(setRuntimeValue).toHaveBeenCalledWith('Fighter', 'secondWindUses', '0', undefined);
     });

  it('renders psionic energy for Psi Warrior', () => {
    const psiStats = {
         ...mockStats,
       class: {
              ...mockStats.class,
           major: { name: 'Psi Warrior' },
           subclass: { name: 'Psi Warrior' },
           class_levels: Array(5).fill({ extra_attacks: 1, second_wind: 2, weapon_mastery: 'Slashing', energy: { required_major: 'Psi Warrior', energy_die_num: 4, energy_die_type: 8 } }),
            },
         };
    render(<CharClassFeatures playerStats={psiStats} />);
    expect(screen.getByText(/Psionic Energy/)).toBeInTheDocument();
     });

  it('does not render psionic energy for non Psi Warrior', () => {
    render(<CharClassFeatures playerStats={mockStats} />);
    expect(screen.queryByText(/Psionic Energy/)).not.toBeInTheDocument();
     });

  it('renders psi warrior energy dice count and type', () => {
    const psiStats = {
         ...mockStats,
       class: {
              ...mockStats.class,
           major: { name: 'Psi Warrior' },
           subclass: { name: 'Psi Warrior' },
           class_levels: Array(5).fill({ extra_attacks: 1, second_wind: 2, weapon_mastery: 'Slashing', energy: { required_major: 'Psi Warrior', energy_die_num: 4, energy_die_type: 8 } }),
            },
         };
    render(<CharClassFeatures playerStats={psiStats} />);
    expect(screen.getByText(/Energy Dice/)).toBeInTheDocument();
    expect(screen.getByText(/d8/)).toBeInTheDocument();
     });
});

/* -- Monk -- */
describe('Monk', () => {
  const mockStats = {
    name: 'Monk',
    level: 3,
    proficiency: 2,
    abilities: [{ name: 'Wisdom', bonus: 3 }],
    class: { name: 'Monk', class_levels: Array.from({ length: 3 }, (_, i) => ({ level: i + 1, extra_attacks: 0 })) },
    };
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getProperty.mockReturnValue(null);
    classRules2024.getMartialArtsDie.mockReturnValue(6);
    classRules2024.getUnarmoredMovementIncrease.mockReturnValue(10);
    classRules2024.getFocusPoints.mockReturnValue(3);
   });

  it('does not render at level 1', () => {
    const stats = { ...mockStats, level: 1 };
    render(<CharClassFeatures playerStats={stats} />);
    expect(screen.queryByText(/Martial Arts Die/)).not.toBeInTheDocument();
     });

  it('renders monk features', () => {
    render(<CharClassFeatures playerStats={mockStats} />);
    expect(screen.getByText(/Martial Arts Die/)).toBeInTheDocument();
    expect(screen.getByText(/Focus Points:/)).toBeInTheDocument();
     });

  it('persists focus points to storage', () => {
    render(<CharClassFeatures playerStats={mockStats} />);
    toggleFirstClickChangeAndSet('0');
    expect(setRuntimeValue).toHaveBeenCalledWith('Monk', 'focusPoints', '0', undefined);
     });
});

/* -- Paladin -- */
describe('Paladin', () => {
  const mockStats = {
    name: 'Paladin',
    level: 5,
    class: {
      name: 'Paladin',
      fightingStyles: ['Defense'],
      class_levels: Array.from({ length: 5 }, (_, i) => ({ level: i + 1, class_specific: { channel_divinity_charges: 2, aura_range: 10 } })),
     },
    };

  it('renders paladin features', () => {
    render(<CharClassFeatures playerStats={mockStats} />);
    expect(screen.getByText(/Fighting Styles:/)).toBeInTheDocument();
    expect(screen.getByText(/Channel Divinity Charges/)).toBeInTheDocument();
     });

  it('shows aura range for 5e', () => {
    render(<CharClassFeatures playerStats={mockStats} />);
    expect(screen.getByText(/Aura Range:/)).toBeInTheDocument();
     });

  it('does not show aura range when null (2024 or low level)', () => {
    const paladinNoAura = {
      name: 'Paladin',
      level: 1,
      rules: '2024',
      class: {
        name: 'Paladin',
        class_levels: [{ level: 1 }],
       },
     };
    render(<CharClassFeatures playerStats={paladinNoAura} />);
    expect(screen.queryByText(/Aura Range:/)).not.toBeInTheDocument();
     });
});

/* -- Ranger -- */
describe('Ranger', () => {
  beforeAll(() => { classRules2024.getFavoredEnemy.mockReturnValue(4); });

  const mockStats = {
    name: 'Ranger',
    level: 5,
    rules: '2024',
    class: { name: 'Ranger', fightingStyles: ['Archery'] },
    };

  it('renders ranger features', () => {
    render(<CharClassFeatures playerStats={mockStats} />);
    expect(screen.getByText(/Extra Attacks:/)).toBeInTheDocument();
    expect(screen.getByText(/Favored Enemies:/)).toBeInTheDocument();
     });
});

/* -- Rogue -- */
describe('Rogue', () => {
  const mockStats5e = {
    name: 'Rogue5e',
    level: 5,
    class: {
      name: 'Rogue',
      expertise: ['Stealth', 'Deception'],
      class_levels: Array.from({ length: 5 }, (_, i) => ({ level: i + 1, class_specific: { sneak_attack: { dice_count: 5, dice_value: 6 } } })),
     },
    };
  const mockStats2024 = {
    name: 'Rogue2024',
    level: 5,
    rules: '2024',
    class: { name: 'Rogue', expertise: ['Perception'], class_levels: Array(5).fill({ sneak_attack_num_d6: 5 }) },
    };

  it('displays sneak attack (5e format)', () => {
    render(<CharClassFeatures playerStats={mockStats5e} />);
    expect(screen.getByText('+5d6')).toBeInTheDocument();
     });

  it('displays sneak attack (2024 format)', () => {
    render(<CharClassFeatures playerStats={mockStats2024} />);
    expect(screen.getByText('+5d6')).toBeInTheDocument();
     });

  it('renders expertise', () => {
    render(<CharClassFeatures playerStats={mockStats5e} />);
    expect(screen.getByText(/Expertise:/)).toBeInTheDocument();
     });
});

/* -- Sorcerer -- */
describe('Sorcerer', () => {
  const mockStats5e = {
    name: 'Sorcerer',
    level: 5,
    rules: '5e',
    class: {
      name: 'Sorcerer',
      class_levels: Array.from({ length: 5 }, (_, i) => ({ level: i + 1, class_specific: { sorcery_points: 4, metamagic_known: 3, creating_spell_slots: [{ sorcery_point_cost: 2 }, { sorcery_point_cost: 3 }, { sorcery_point_cost: 4 }] } })),
     },
    };
  const mockStats2024 = {
    name: 'Sorcerer2024',
    level: 5,
    rules: '2024',
    class: { name: 'Sorcerer', class_levels: Array(5).fill({ sorcery_points: 4 }) },
    };
  beforeEach(() => { vi.clearAllMocks(); getRuntimeValue.mockReturnValue(null); });

  it('renders sorcery points (5e)', () => {
    render(<CharClassFeatures playerStats={mockStats5e} />);
    expect(screen.getByText(/Sorcery Points:/)).toBeInTheDocument();
     });

  it('renders spell slot costs (5e only)', () => {
    render(<CharClassFeatures playerStats={mockStats5e} />);
    expect(screen.getByText(/Spell Slot \(level 1-5\) Costs:/)).toBeInTheDocument();
     });

  it('metamagic known at level 10 (2024)', () => {
     const stats = { ...mockStats2024, level: 10, class: { name: 'Sorcerer', class_levels: Array(10).fill({ sorcery_points: 8 }) } };
    render(<CharClassFeatures playerStats={stats} />);
    expect(screen.getByText(/Metamagic Known:/).parentElement.textContent).toContain('4');
     });

  it('persists sorcery points to storage', () => {
    render(<CharClassFeatures playerStats={mockStats5e} />);
    toggleFirstClickChangeAndSet('2');
    expect(setRuntimeValue).toHaveBeenCalledWith('Sorcerer', 'sorceryPoints', '2', undefined);
     });
});

/* -- Warlock -- */
describe('Warlock', () => {
  const mockStats5e = {
    name: 'Warlock5e',
    level: 11,
    rules: '5e',
    class: {
      name: 'Warlock',
      invocations: ['Agonizing Blast'],
      pactBoon: 'Pact of the Blade',
      arcanums: ['Cone of Cold'],
      class_levels: Array.from({ length: 11 }, (_, i) => ({ level: i + 1, class_specific: { invocations_known: 6, mystic_arcanum_level_6: 1, mystic_arcanum_level_7: 1, mystic_arcanum_level_8: 1, mystic_arcanum_level_9: 1 } })),
     },
    };
  const mockStats2024 = {
    name: 'Warlock2024',
    level: 5,
    rules: '2024',
    class: { name: 'Warlock', invocations: ['Agonizing Blast'], eldritchInvocations: ['Arcane Charge'] },
    };
  beforeEach(() => { vi.clearAllMocks(); classRules2024.getEldritchInvocations.mockReturnValue(4); });

  it('renders invocations known (5e)', () => {
    render(<CharClassFeatures playerStats={mockStats5e} />);
    const warlockEl = screen.getByTestId('char-class-warlock');
    expect(warlockEl.textContent).toContain('6');
     });

  it('renders eldritch invocations (2024)', () => {
    render(<CharClassFeatures playerStats={mockStats2024} />);
    expect(screen.getByText(/Eldritch Invocations:/)).toBeInTheDocument();
     });

  it('shows pact boon when defined', () => {
    render(<CharClassFeatures playerStats={mockStats5e} />);
    expect(screen.getByText(/Pact Boon:/)).toBeInTheDocument();
     });

  it('uses classRules2024 for 2024 rules', () => {
    render(<CharClassFeatures playerStats={mockStats2024} />);
    expect(classRules2024.getEldritchInvocations).toHaveBeenCalled();
     });

  it('shows arcanum features for level 11+ (5e)', () => {
    render(<CharClassFeatures playerStats={mockStats5e} />);
    expect(screen.getByText(/Arcanums Known/)).toBeInTheDocument();
    const warlockEl = screen.getByTestId('char-class-warlock');
    expect(warlockEl.textContent).toContain('Cone of Cold');
     });

  it('does not show arcanum features for level &lt;= 10 (5e)', () => {
    const lowLevelWarlock = {
      name: 'WarlockLow',
      level: 5,
      rules: '5e',
      class: {
        name: 'Warlock',
        invocations: ['Agonizing Blast'],
        arcanums: [],
        class_levels: Array.from({ length: 5 }, (_, i) => ({ level: i + 1, class_specific: { invocations_known: 3 } })),
       },
     };
    render(<CharClassFeatures playerStats={lowLevelWarlock} />);
    expect(screen.queryByText(/Arcanums Known/)).not.toBeInTheDocument();
     });

  it('shows invocations list for warlock', () => {
    render(<CharClassFeatures playerStats={mockStats5e} />);
    expect(screen.getByText(/Agonizing Blast/)).toBeInTheDocument();
     });
});

/* -- Wizard -- */
describe('Wizard', () => {
  const mockStats5e = {
    name: 'Wizard',
    level: 5,
    rules: '5e',
    class: {
      name: 'Wizard',
      class_levels: Array.from({ length: 5 }, (_, i) => ({ level: i + 1, class_specific: { arcane_recovery_levels: 1 } })),
     },
    };
  beforeEach(() => { vi.clearAllMocks(); getRuntimeValue.mockReturnValue(null); });

  it('does not render for 2024 rules', () => {
    const stats = { ...mockStats5e, rules: '2024', class: { name: 'Wizard' } };
    const { container } = render(<CharClassFeatures playerStats={stats} />);
    expect(container.querySelector('div')).toBeNull();
     });

  it('renders arcane recovery for 5e', () => {
    render(<CharClassFeatures playerStats={mockStats5e} />);
    expect(screen.getByText(/Arcane Recovery Levels:/)).toBeInTheDocument();
     });

  it('persists arcane recovery levels to storage', () => {
    render(<CharClassFeatures playerStats={mockStats5e} />);
    toggleFirstClickChangeAndSet('0');
    expect(setRuntimeValue).toHaveBeenCalledWith('Wizard', 'arcaneRecoveryLevels', '0', undefined);
     });

  it('renders when showWizardFeatures is undefined (defaults to true)', () => {
    classRules.getWizardFeatures.mockReturnValue({ arcaneRecoveryLevels: 1 });
    const stats = { ...mockStats5e, class: { name: 'Wizard', class_levels: Array.from({ length: 5 }, (_, i) => ({ level: i + 1, class_specific: { arcane_recovery_levels: 1 } })) } };
    render(<CharClassFeatures playerStats={stats} />);
    expect(screen.getByText(/Arcane Recovery Levels:/)).toBeInTheDocument();
     });
});

/* -- Unknown class -- */
describe('Unknown class', () => {
  it('returns null for unrecognized class', () => {
    const { container } = render(<CharClassFeatures playerStats={{ class: { name: 'Artificer' } }} />);
    expect(container.querySelector('div')).toBeNull();
     });
});
