import { ABILITY_ABBR, ABILITY_LABELS } from '../../services/npcs/npcFormUtils.js';
import { calculateAbilityModifier } from '../../services/encounters/npcStatBlockUtils.js';

function NPCStatBlockForm({ formData, setFormData }) {
  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAbilityScoreChange = (ability, value) => {
    const score = parseInt(value) || 0;
    setFormData((prev) => ({
      ...prev,
      abilityScores: { ...prev.abilityScores, [ability]: score },
    }));
  };

  const handleSaveBonusChange = (ability, value) => {
    setFormData((prev) => ({
      ...prev,
      savingThrowBonuses: { ...prev.savingThrowBonuses, [ability]: value },
    }));
  };

  const handleSkillBonusChange = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      skillBonuses: { ...prev.skillBonuses, [name]: value },
    }));
  };

  const handleRemoveSkill = (name) => {
    setFormData((prev) => {
      const updated = { ...prev.skillBonuses };
      delete updated[name];
      return { ...prev, skillBonuses: updated };
    });
  };

  const handleArrayField = (field, value) => {
    const items = value.split(',').map(s => s.trim()).filter(Boolean);
    setFormData((prev) => ({ ...prev, [field]: items }));
  };

  const handleActionChange = (index, field, value) => {
    setFormData((prev) => {
      const actions = [...(prev.actions || [])];
      actions[index] = { ...actions[index], [field]: value };
      return { ...prev, actions };
    });
  };

  const handleAddAction = () => {
    setFormData((prev) => ({
      ...prev,
      actions: [...(prev.actions || []), { name: '', attack_bonus: '', damage_dice: '', description: '' }],
    }));
  };

  const handleRemoveAction = (index) => {
    setFormData((prev) => ({
      ...prev,
      actions: (prev.actions || []).filter((_, i) => i !== index),
    }));
  };

  return (
    <>
      <h4 className="npcs-section-title">Combat Stats</h4>
      <div className="npcs-stats-grid">
        <div className="npcs-stat-field">
          <label>AC</label>
          <input
            type="number"
            min="0"
            className="ct-input"
            value={formData.armorClass ?? ''}
            onChange={(e) => handleFieldChange('armorClass', e.target.value ? parseInt(e.target.value) : null)}
            placeholder="10"
          />
        </div>
        <div className="npcs-stat-field">
          <label>HP</label>
          <input
            type="text"
            className="ct-input"
            value={formData.hitPoints}
            onChange={(e) => handleFieldChange('hitPoints', e.target.value)}
            placeholder="e.g., 45"
          />
        </div>
        <div className="npcs-stat-field">
          <label>Hit Dice</label>
          <input
            type="text"
            className="ct-input"
            value={formData.hitDice}
            onChange={(e) => handleFieldChange('hitDice', e.target.value)}
            placeholder="e.g., 6d8"
          />
        </div>
        <div className="npcs-stat-field">
          <label>Speed</label>
          <input
            type="text"
            className="ct-input"
            value={formData.speed?.walk || ''}
            onChange={(e) => handleFieldChange('speed', { ...formData.speed, walk: e.target.value })}
            placeholder="30 ft."
          />
        </div>
        <div className="npcs-stat-field">
          <label>Initiative Bonus</label>
          <input
            type="number"
            className="ct-input"
            value={formData.initiativeBonus}
            onChange={(e) => handleFieldChange('initiativeBonus', e.target.value)}
            placeholder="+0"
          />
        </div>
      </div>

      <h4 className="npcs-section-title">Ability Scores</h4>
      <div className="npcs-abilities-grid">
        {ABILITY_ABBR.map((ab) => {
          const score = formData.abilityScores?.[ab] ?? 10;
          const mod = calculateAbilityModifier(score);
          const saveBonus = formData.savingThrowBonuses?.[ab] ?? '';
          return (
            <div key={ab} className="npcs-ability-group">
              <label className="npcs-ability-label">{ABILITY_LABELS[ab]}</label>
              <input
                type="number"
                min="1"
                max="30"
                className="ct-input npcs-ability-input"
                value={score}
                onChange={(e) => handleAbilityScoreChange(ab, e.target.value)}
              />
              <span className="npcs-ability-mod">{mod >= 0 ? '+' : ''}{mod}</span>
              <input
                type="text"
                className="ct-input npcs-save-input"
                value={saveBonus}
                onChange={(e) => handleSaveBonusChange(ab, e.target.value)}
                placeholder="Save"
                title="Saving throw bonus"
              />
            </div>
          );
        })}
      </div>

      <h4 className="npcs-section-title">Skill Bonuses</h4>
      <div className="npcs-skills-section">
        {Object.entries(formData.skillBonuses || {}).map(([name, bonus], index) => (
          <div key={index} className="npcs-skill-row">
            <input
              type="text"
              className="ct-input npcs-skill-name"
              value={name}
              onChange={(e) => {
                const newName = e.target.value;
                if (newName !== name) {
                  handleRemoveSkill(name);
                  handleSkillBonusChange(newName, bonus);
                }
              }}
              placeholder="Skill name"
            />
            <input
              type="text"
              className="ct-input npcs-skill-bonus"
              value={bonus}
              onChange={(e) => handleSkillBonusChange(name, e.target.value)}
              placeholder="+0"
            />
            <button
              className="ct-btn ct-btn-sm ct-btn-danger"
              onClick={() => handleRemoveSkill(name)}
              title="Remove skill"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        ))}
        <button className="ct-btn ct-btn-sm" onClick={() => handleSkillBonusChange('', '')}>
          <i className="fa-solid fa-plus" /> Add Skill
        </button>
      </div>

      <h4 className="npcs-section-title">Defenses</h4>
      <label>Damage Resistances (comma separated)</label>
      <input
        type="text"
        className="ct-input"
        value={(formData.damageResistances || []).join(', ')}
        onChange={(e) => handleArrayField('damageResistances', e.target.value)}
        placeholder="fire, cold, poison"
      />
      <label>Damage Immunities (comma separated)</label>
      <input
        type="text"
        className="ct-input"
        value={(formData.damageImmunities || []).join(', ')}
        onChange={(e) => handleArrayField('damageImmunities', e.target.value)}
        placeholder="necrotic, psychic"
      />
      <label>Condition Immunities (comma separated)</label>
      <input
        type="text"
        className="ct-input"
        value={(formData.conditionImmunities || []).join(', ')}
        onChange={(e) => handleArrayField('conditionImmunities', e.target.value)}
        placeholder="charmed, frightened"
      />

      <h4 className="npcs-section-title">Actions</h4>
      <div className="npcs-actions-section">
        {(formData.actions || []).map((action, i) => (
          <div key={i} className="npcs-action-row">
            <div className="npcs-action-fields-row">
              <input
                type="text"
                className="ct-input npcs-action-name"
                value={action.name}
                onChange={(e) => handleActionChange(i, 'name', e.target.value)}
                placeholder="Action name"
              />
              <input
                type="text"
                className="ct-input npcs-action-bonus"
                value={action.attack_bonus}
                onChange={(e) => handleActionChange(i, 'attack_bonus', e.target.value)}
                placeholder="Atk bonus"
              />
              <input
                type="text"
                className="ct-input npcs-action-damage"
                value={action.damage_dice}
                onChange={(e) => handleActionChange(i, 'damage_dice', e.target.value)}
                placeholder="Damage"
              />
              <button
                className="ct-btn ct-btn-sm ct-btn-danger"
                onClick={() => handleRemoveAction(i)}
                title="Remove action"
              >
                <i className="fa-solid fa-trash-can" />
              </button>
            </div>
            <textarea
              className="ct-textarea npcs-action-desc"
              value={action.description || ''}
              onChange={(e) => handleActionChange(i, 'description', e.target.value)}
              placeholder="Description"
              rows={2}
            />
          </div>
        ))}
        <button className="ct-btn ct-btn-sm" onClick={handleAddAction}>
          <i className="fa-solid fa-plus" /> Add Action
        </button>
      </div>

      <h4 className="npcs-section-title">Traits</h4>
      <textarea
        className="ct-textarea"
        value={formData.traits}
        onChange={(e) => handleFieldChange('traits', e.target.value)}
        placeholder="Special traits (one per line or markdown)"
        rows={3}
      />

      <h4 className="npcs-section-title">Reactions</h4>
      <textarea
        className="ct-textarea"
        value={formData.reactions}
        onChange={(e) => handleFieldChange('reactions', e.target.value)}
        placeholder="Reactions (one per line or markdown)"
        rows={3}
      />
    </>
  );
}

export default NPCStatBlockForm;
