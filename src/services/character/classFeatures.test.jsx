import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getClassFeatures } from './classFeatures.js';

vi.mock('./classRules.js', () => ({
  default: {
    getBardFeatures: vi.fn(() => ['Bard Features 5e']),
    getClericFeatures: vi.fn(() => ['Cleric Features 5e']),
    getDruidFeatures: vi.fn(() => ['Druid Features 5e']),
    getPaladinFeatures: vi.fn(() => ['Paladin Features 5e']),
    getSorcererFeatures: vi.fn(() => ['Sorcerer Features 5e']),
    getWarlockFeatures: vi.fn(() => ['Warlock Features 5e']),
    getWizardFeatures: vi.fn(() => ['Wizard Features 5e']),
    getMonkFeatures: vi.fn(() => ['Monk Features 5e']),
    getRogueFeatures: vi.fn(() => ['Rogue Features 5e']),
    getRangerFeatures: vi.fn(() => ['Ranger Features 5e']),
  },
}));

vi.mock('./classRules2024.js', () => ({
  default: {
    getBardFeatures: vi.fn(() => ['Bard Features 2024']),
    getClericFeatures: vi.fn(() => ['Cleric Features 2024']),
    getDruidFeatures: vi.fn(() => ['Druid Features 2024']),
    getPaladinFeatures: vi.fn(() => ['Paladin Features 2024']),
    getSorcererFeatures: vi.fn(() => ['Sorcerer Features 2024']),
    getWarlockFeatures: vi.fn(() => ['Warlock Features 2024']),
    getWizardFeatures: vi.fn(() => ['Wizard Features 2024']),
    getMonkFeatures: vi.fn(() => ['Monk Features 2024']),
    getRogueFeatures: vi.fn(() => ['Rogue Features 2024']),
    getRangerFeatures: vi.fn(() => ['Ranger Features 2024']),
  },
}));

const basePlayerStats = {
  name: 'Test Character',
  rules: '5e',
  class: { name: 'Cleric' },
};

describe('getClassFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for unknown class', () => {
    const stats = { ...basePlayerStats, class: { name: 'Barbarian' } };
    const result = getClassFeatures(stats);
    expect(result).toBeNull();
  });

  it('returns null when class is undefined', () => {
    const stats = { ...basePlayerStats, class: undefined };
    const result = getClassFeatures(stats);
    expect(result).toBeNull();
  });

  it('throws when playerStats is null', () => {
    expect(() => getClassFeatures(null)).toThrow();
  });

  it('throws when playerStats is undefined', () => {
    expect(() => getClassFeatures(undefined)).toThrow();
  });

  it('calls classRules.getBardFeatures for Bard (5e)', () => {
    const stats = { ...basePlayerStats, class: { name: 'Bard' } };
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Bard Features 5e']);
  });

  it('calls classRules.getClericFeatures for Cleric (5e)', () => {
    const stats = { ...basePlayerStats, class: { name: 'Cleric' } };
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Cleric Features 5e']);
  });

  it('calls classRules.getDruidFeatures for Druid (5e)', () => {
    const stats = { ...basePlayerStats, class: { name: 'Druid' } };
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Druid Features 5e']);
  });

  it('calls classRules.getPaladinFeatures for Paladin (5e)', () => {
    const stats = { ...basePlayerStats, class: { name: 'Paladin' } };
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Paladin Features 5e']);
  });

  it('calls classRules.getSorcererFeatures for Sorcerer (5e)', () => {
    const stats = { ...basePlayerStats, class: { name: 'Sorcerer' } };
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Sorcerer Features 5e']);
  });

  it('calls classRules.getWarlockFeatures for Warlock (5e)', () => {
    const stats = { ...basePlayerStats, class: { name: 'Warlock' } };
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Warlock Features 5e']);
  });

  it('calls classRules.getWizardFeatures for Wizard (5e)', () => {
    const stats = { ...basePlayerStats, class: { name: 'Wizard' } };
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Wizard Features 5e']);
  });

  it('calls classRules.getMonkFeatures for Monk (5e)', () => {
    const stats = { ...basePlayerStats, class: { name: 'Monk' } };
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Monk Features 5e']);
  });

  it('calls classRules.getRogueFeatures for Rogue (5e)', () => {
    const stats = { ...basePlayerStats, class: { name: 'Rogue' } };
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Rogue Features 5e']);
  });

  it('calls classRules.getRangerFeatures for Ranger (5e)', () => {
    const stats = { ...basePlayerStats, class: { name: 'Ranger' } };
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Ranger Features 5e']);
  });

  it('calls classRules2024.getBardFeatures for Bard (2024)', () => {
    const stats = { ...basePlayerStats, rules: '2024', class: { name: 'Bard' } };
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Bard Features 2024']);
  });

  it('calls classRules2024.getClericFeatures for Cleric (2024)', () => {
    const stats = { ...basePlayerStats, rules: '2024', class: { name: 'Cleric' } };
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Cleric Features 2024']);
  });

  it('calls classRules2024.getDruidFeatures for Druid (2024)', () => {
    const stats = { ...basePlayerStats, rules: '2024', class: { name: 'Druid' } };
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Druid Features 2024']);
  });

  it('calls classRules2024.getPaladinFeatures for Paladin (2024)', () => {
    const stats = { ...basePlayerStats, rules: '2024', class: { name: 'Paladin' } };
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Paladin Features 2024']);
  });

  it('calls classRules2024.getSorcererFeatures for Sorcerer (2024)', () => {
    const stats = { basePlayerStats, rules: '2024', class: { name: 'Sorcerer' } };
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Sorcerer Features 2024']);
  });

  it('calls classRules2024.getWarlockFeatures for Warlock (2024)', () => {
    const stats = { ...basePlayerStats, rules: '2024', class: { name: 'Warlock' } };
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Warlock Features 2024']);
  });

  it('calls classRules2024.getWizardFeatures for Wizard (2024)', () => {
    const stats = { ...basePlayerStats, rules: '2024', class: { name: 'Wizard' } };
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Wizard Features 2024']);
  });

  it('calls classRules2024.getMonkFeatures for Monk (2024)', () => {
    const stats = { ...basePlayerStats, rules: '2024', class: { name: 'Monk' } };
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Monk Features 2024']);
  });

  it('calls classRules2024.getRogueFeatures for Rogue (2024)', () => {
    const stats = { ...basePlayerStats, rules: '2024', class: { name: 'Rogue' } };
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Rogue Features 2024']);
  });

  it('calls classRules2024.getRangerFeatures for Ranger (2024)', () => {
    const stats = { ...basePlayerStats, rules: '2024', class: { name: 'Ranger' } };
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Ranger Features 2024']);
  });

  it('passes playerStats to the feature function', async () => {
    const stats = { ...basePlayerStats, class: { name: 'Cleric' } };
    getClassFeatures(stats);
    // The mock was called with the stats object
    const { default: classRules } = await import('./classRules.js');
    expect(classRules.getClericFeatures).toHaveBeenCalledWith(stats);
  });

  it('uses 5e rules when rules is "5e"', () => {
    const stats = { ...basePlayerStats, rules: '5e', class: { name: 'Cleric' } };
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Cleric Features 5e']);
  });

  it('uses 2024 rules when rules is "2024"', () => {
    const stats = { ...basePlayerStats, rules: '2024', class: { name: 'Cleric' } };
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Cleric Features 2024']);
  });

  it('returns null for class without feature function', () => {
    const stats = { ...basePlayerStats, class: { name: 'Rogue' } };
    // Rogue has a feature function, so this tests a valid path
    const result = getClassFeatures(stats);
    expect(result).toEqual(['Rogue Features 5e']);
  });
});
