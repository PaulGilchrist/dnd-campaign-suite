import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('classFeatures', () => {
  let classRules;
  let classRules2024;

  beforeEach(() => {
    vi.resetModules();
    classRules = vi.fn();
    classRules2024 = vi.fn();
    vi.doMock('./classRules.js', () => ({ default: classRules }));
    vi.doMock('./classRules2024.js', () => ({ default: classRules2024 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null for unknown class name', async () => {
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '5e', class: { name: 'Fighter' } });
    expect(result).toBeNull();
  });

  it('calls classRules.getBardFeatures for Bard 5e', async () => {
    classRules.getBardFeatures = vi.fn().mockReturnValue({ bardicInspiration: 4 });
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '5e', class: { name: 'Bard' } });
    expect(classRules.getBardFeatures).toHaveBeenCalled();
    expect(result).toEqual({ bardicInspiration: 4 });
  });

  it('calls classRules2024.getBardFeatures for Bard 2024', async () => {
    classRules2024.getBardFeatures = vi.fn().mockReturnValue({ bardicDie: 6 });
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '2024', class: { name: 'Bard' } });
    expect(classRules2024.getBardFeatures).toHaveBeenCalled();
    expect(result).toEqual({ bardicDie: 6 });
  });

  it('calls classRules.getClericFeatures for Cleric 5e', async () => {
    classRules.getClericFeatures = vi.fn().mockReturnValue({ maxChannelDivinity: 2 });
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '5e', class: { name: 'Cleric' } });
    expect(classRules.getClericFeatures).toHaveBeenCalled();
    expect(result).toEqual({ maxChannelDivinity: 2 });
  });

  it('calls classRules2024.getClericFeatures for Cleric 2024', async () => {
    classRules2024.getClericFeatures = vi.fn().mockReturnValue({ maxChannelDivinity: 3 });
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '2024', class: { name: 'Cleric' } });
    expect(classRules2024.getClericFeatures).toHaveBeenCalled();
    expect(result).toEqual({ maxChannelDivinity: 3 });
  });

  it('calls classRules.getDruidFeatures for Druid 5e', async () => {
    classRules.getDruidFeatures = vi.fn().mockReturnValue({ maxWildShapeUses: 2 });
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '5e', class: { name: 'Druid' } });
    expect(classRules.getDruidFeatures).toHaveBeenCalled();
    expect(result).toEqual({ maxWildShapeUses: 2 });
  });

  it('calls classRules2024.getDruidFeatures for Druid 2024', async () => {
    classRules2024.getDruidFeatures = vi.fn().mockReturnValue({ maxWildShapeUses: 3 });
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '2024', class: { name: 'Druid' } });
    expect(classRules2024.getDruidFeatures).toHaveBeenCalled();
    expect(result).toEqual({ maxWildShapeUses: 3 });
  });

  it('calls classRules.getPaladinFeatures for Paladin 5e', async () => {
    classRules.getPaladinFeatures = vi.fn().mockReturnValue({ maxChannelDivinity: 2 });
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '5e', class: { name: 'Paladin' } });
    expect(classRules.getPaladinFeatures).toHaveBeenCalled();
    expect(result).toEqual({ maxChannelDivinity: 2 });
  });

  it('calls classRules2024.getPaladinFeatures for Paladin 2024', async () => {
    classRules2024.getPaladinFeatures = vi.fn().mockReturnValue({ maxChannelDivinity: 3 });
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '2024', class: { name: 'Paladin' } });
    expect(classRules2024.getPaladinFeatures).toHaveBeenCalled();
    expect(result).toEqual({ maxChannelDivinity: 3 });
  });

  it('calls classRules.getSorcererFeatures for Sorcerer 5e', async () => {
    classRules.getSorcererFeatures = vi.fn().mockReturnValue({ maxSorceryPoints: 5 });
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '5e', class: { name: 'Sorcerer' } });
    expect(classRules.getSorcererFeatures).toHaveBeenCalled();
    expect(result).toEqual({ maxSorceryPoints: 5 });
  });

  it('calls classRules2024.getSorcererFeatures for Sorcerer 2024', async () => {
    classRules2024.getSorcererFeatures = vi.fn().mockReturnValue({ maxSorceryPoints: 10 });
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '2024', class: { name: 'Sorcerer' } });
    expect(classRules2024.getSorcererFeatures).toHaveBeenCalled();
    expect(result).toEqual({ maxSorceryPoints: 10 });
  });

  it('calls classRules.getWarlockFeatures for Warlock 5e', async () => {
    classRules.getWarlockFeatures = vi.fn().mockReturnValue({ invocationsKnown: 2 });
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '5e', class: { name: 'Warlock' } });
    expect(classRules.getWarlockFeatures).toHaveBeenCalled();
    expect(result).toEqual({ invocationsKnown: 2 });
  });

  it('calls classRules2024.getWarlockFeatures for Warlock 2024', async () => {
    classRules2024.getWarlockFeatures = vi.fn().mockReturnValue({ invocationsKnown: 4 });
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '2024', class: { name: 'Warlock' } });
    expect(classRules2024.getWarlockFeatures).toHaveBeenCalled();
    expect(result).toEqual({ invocationsKnown: 4 });
  });

  it('calls classRules.getWizardFeatures for Wizard 5e', async () => {
    classRules.getWizardFeatures = vi.fn().mockReturnValue({ arcaneRecoveryLevels: 1 });
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '5e', class: { name: 'Wizard' } });
    expect(classRules.getWizardFeatures).toHaveBeenCalled();
    expect(result).toEqual({ arcaneRecoveryLevels: 1 });
  });

  it('calls classRules2024.getWizardFeatures for Wizard 2024', async () => {
    classRules2024.getWizardFeatures = vi.fn().mockReturnValue({ arcaneRecoveryLevels: 2 });
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '2024', class: { name: 'Wizard' } });
    expect(classRules2024.getWizardFeatures).toHaveBeenCalled();
    expect(result).toEqual({ arcaneRecoveryLevels: 2 });
  });

  it('calls classRules.getMonkFeatures for Monk 5e', async () => {
    classRules.getMonkFeatures = vi.fn().mockReturnValue({ martialArtsDie: 4 });
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '5e', class: { name: 'Monk' } });
    expect(classRules.getMonkFeatures).toHaveBeenCalled();
    expect(result).toEqual({ martialArtsDie: 4 });
  });

  it('calls classRules2024.getMonkFeatures for Monk 2024', async () => {
    classRules2024.getMonkFeatures = vi.fn().mockReturnValue({ martialArtsDie: 6 });
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '2024', class: { name: 'Monk' } });
    expect(classRules2024.getMonkFeatures).toHaveBeenCalled();
    expect(result).toEqual({ martialArtsDie: 6 });
  });

  it('calls classRules.getRogueFeatures for Rogue 5e', async () => {
    classRules.getRogueFeatures = vi.fn().mockReturnValue({ sneakAttack: { dice_count: 3, dice_value: 6 } });
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '5e', class: { name: 'Rogue' } });
    expect(classRules.getRogueFeatures).toHaveBeenCalled();
    expect(result).toEqual({ sneakAttack: { dice_count: 3, dice_value: 6 } });
  });

  it('calls classRules2024.getRogueFeatures for Rogue 2024', async () => {
    classRules2024.getRogueFeatures = vi.fn().mockReturnValue({ sneakAttack: { dice_count: 5, dice_value: 6 } });
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '2024', class: { name: 'Rogue' } });
    expect(classRules2024.getRogueFeatures).toHaveBeenCalled();
    expect(result).toEqual({ sneakAttack: { dice_count: 5, dice_value: 6 } });
  });

  it('calls classRules.getRangerFeatures for Ranger 5e', async () => {
    classRules.getRangerFeatures = vi.fn().mockReturnValue({ favoredEnemies: 1 });
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '5e', class: { name: 'Ranger' } });
    expect(classRules.getRangerFeatures).toHaveBeenCalled();
    expect(result).toEqual({ favoredEnemies: 1 });
  });

  it('calls classRules2024.getRangerFeatures for Ranger 2024', async () => {
    classRules2024.getRangerFeatures = vi.fn().mockReturnValue({ favoredEnemies: 2 });
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '2024', class: { name: 'Ranger' } });
    expect(classRules2024.getRangerFeatures).toHaveBeenCalled();
    expect(result).toEqual({ favoredEnemies: 2 });
  });


  it('handles playerStats with no class property', async () => {
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '5e' });
    expect(result).toBeNull();
  });

  it('handles playerStats with null class property', async () => {
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '5e', class: null });
    expect(result).toBeNull();
  });

  it('prefers classRules2024 over classRules for 2024 ruleset', async () => {
    classRules.getBardFeatures = vi.fn().mockReturnValue({ from5e: true });
    classRules2024.getBardFeatures = vi.fn().mockReturnValue({ from2024: true });
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '2024', class: { name: 'Bard' } });
    expect(classRules.getBardFeatures).not.toHaveBeenCalled();
    expect(classRules2024.getBardFeatures).toHaveBeenCalled();
    expect(result).toEqual({ from2024: true });
  });
});
