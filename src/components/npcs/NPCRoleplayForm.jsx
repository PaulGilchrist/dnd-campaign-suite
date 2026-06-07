import { ATTITUDE_OPTIONS } from '../../services/npcs/npcFormUtils.js';
import PreviewToggle from '../common/PreviewToggle.jsx';

function NPCRoleplayForm({ formData, onFieldChange }) {
  return (
    <>
      <label htmlFor="npc-race" className="ct-label">Race</label>
      <input
        id="npc-race"
        type="text"
        className="ct-input"
        value={formData.race}
        onChange={(e) => onFieldChange('race', e.target.value)}
        placeholder="e.g., Human, Elf, Dwarf"
      />

      <label htmlFor="npc-classRole" className="ct-label">Class / Role</label>
      <input
        id="npc-classRole"
        type="text"
        className="ct-input"
        value={formData.classRole}
        onChange={(e) => onFieldChange('classRole', e.target.value)}
        placeholder="e.g., Fighter, Wizard, Merchant"
      />

      <label htmlFor="npc-attitude" className="ct-label">Attitude</label>
      <select
        id="npc-attitude"
        className="ct-select"
        value={formData.attitude}
        onChange={(e) => onFieldChange('attitude', e.target.value)}
      >
        {ATTITUDE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>

      <PreviewToggle
        id="npc-appearance"
        value={formData.appearance}
        onChange={(value) => onFieldChange('appearance', value)}
        placeholder="Physical description…"
        label="Appearance"
      />
      <PreviewToggle
        id="npc-personality"
        value={formData.personality}
        onChange={(value) => onFieldChange('personality', value)}
        placeholder="Personality traits, ideals, bonds, flaws…"
        label="Personality"
      />
      <PreviewToggle
        id="npc-goals"
        value={formData.goals}
        onChange={(value) => onFieldChange('goals', value)}
        placeholder="What does this NPC want?"
        label="Goals"
      />
      <PreviewToggle
        id="npc-secrets"
        value={formData.secrets}
        onChange={(value) => onFieldChange('secrets', value)}
        placeholder="Hidden truths about this NPC…"
        label="Secrets"
      />
      <PreviewToggle
        id="npc-notes"
        value={formData.notes}
        onChange={(value) => onFieldChange('notes', value)}
        placeholder="Additional notes…"
        label="Notes"
      />

      <label htmlFor="npc-tags" className="ct-label">Tags (comma separated)</label>
      <input
        id="npc-tags"
        type="text"
        className="ct-input"
        value={formData.tags}
        onChange={(e) => onFieldChange('tags', e.target.value)}
        placeholder="e.g., ally, enemy, quest-giver"
      />
    </>
  );
}

export default NPCRoleplayForm;
