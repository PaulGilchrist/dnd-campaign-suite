import { useState, useEffect, useMemo } from 'react';
import useNPCsManagement from '../../hooks/useNPCsManagement.js';
import PreviewToggle from '../common/PreviewToggle.jsx';
import AvatarImage from '../common/AvatarImage.jsx';
import AvatarModal from '../common/AvatarModal.jsx';
import { npcHasStatBlock, calculateAbilityModifier } from '../../services/npcStatBlockUtils.js';
import { rollD20 } from '../../services/diceRoller.js';
import utils from '../../services/utils.js';
import './NPCs.css';

const ABILITY_ABBR = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ABILITY_LABELS = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };

const ATTITUDE_OPTIONS = [
  { value: 'deep bonds', label: 'Deep Bonds' },
  { value: 'positive', label: 'Positive' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'negative', label: 'Negative' },
  { value: 'extreme opposition', label: 'Extreme Opposition' },
];

const ATTITUDE_COLORS = {
  'deep bonds': { bg: '#1a472a', color: '#90ee90', border: '#2d6a4f' },
  positive: { bg: '#1b4332', color: '#b7e4c7', border: '#40916c' },
  neutral: { bg: '#4a4a4a', color: '#e0e0e0', border: '#6b6b6b' },
  negative: { bg: '#7b241c', color: '#f4a0a0', border: '#a43330' },
  'extreme opposition': { bg: '#5c030e', color: '#ff6b6b', border: '#8b0000' },
};

function NPCs({ campaignName, onBack, onViewInitiative }) {
  const { npcs, loading, loadNPCsList, saveNPCAction, deleteNPCAction } =
    useNPCsManagement(campaignName);

  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNPC, setEditingNPC] = useState(null);
  const [formData, setFormData] = useState(null);
  const [activeTab, setActiveTab] = useState('roleplay');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showNpcAvatarModal, setShowNpcAvatarModal] = useState(false);

  useEffect(() => {
    if (campaignName) {
      loadNPCsList();
    }
  }, [campaignName, loadNPCsList]);

  const filteredNPCs = useMemo(() => {
    if (!searchQuery.trim()) return npcs;
    const query = searchQuery.toLowerCase();
    return npcs.filter(
      (npc) =>
        npc.name?.toLowerCase().includes(query) ||
        npc.race?.toLowerCase().includes(query) ||
        npc.classRole?.toLowerCase().includes(query) ||
        npc.tags?.toLowerCase().includes(query)
    );
  }, [npcs, searchQuery]);

  const getDefaultFormData = (overrides = {}) => ({
    name: '',
    race: '',
    classRole: '',
    appearance: '',
    personality: '',
    goals: '',
    secrets: '',
    notes: '',
    tags: '',
    attitude: 'neutral',
    image: '',
    imageName: '',
    imagePath: '',
    armorClass: null,
    hitPoints: '',
    hitDice: '',
    initiativeBonus: '',
    speed: { walk: '30 ft.' },
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrowBonuses: {},
    skillBonuses: {},
    damageResistances: [],
    damageImmunities: [],
    conditionImmunities: [],
    actions: [],
    traits: '',
    reactions: '',
    ...overrides,
  });

  const handleNewNPC = () => {
    setFormData(getDefaultFormData());
    setEditingNPC(null);
    setActiveTab('roleplay');
    setModalOpen(true);
  };

  const handleEditNPC = (npc) => {
    setFormData(getDefaultFormData(npc));
    setEditingNPC(npc);
    setActiveTab('roleplay');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setFormData(null);
    setEditingNPC(null);
  };

  const handleFormChange = (field, value) => {
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

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      handleFormChange('image', event.target.result);
      handleFormChange('imageName', file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    handleFormChange('image', '');
    handleFormChange('imageName', '');
    handleFormChange('imagePath', '');
  };

  const handleSave = async () => {
    if (!formData || !formData.name.trim()) return;
    setSaving(true);
    try {
      const cleaned = { ...formData };
      if (cleaned.armorClass === null || cleaned.armorClass === undefined || cleaned.armorClass === '') {
        delete cleaned.armorClass;
      }
      if (cleaned.armorClass === undefined) {
        cleaned.armorClass = null;
      }
      await saveNPCAction(cleaned, editingNPC?.name);
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save NPC:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingNPC) return;
    if (!window.confirm('Delete this NPC?')) return;
    setDeleting(true);
    try {
      await deleteNPCAction(editingNPC.name);
      handleCloseModal();
    } catch (error) {
      console.error('Failed to delete NPC:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleAddToInitiative = async (npc) => {
    if (!npcHasStatBlock(npc)) return;
    try {
      const initBonus = parseInt(npc.initiativeBonus) || 0;
      const stored = localStorage.getItem('combatSummary');
      let combatSummary = stored ? JSON.parse(stored) : null;
      if (!combatSummary) {
        combatSummary = { round: 1, creatures: [] };
      }
      const alreadyAdded = combatSummary.creatures.some(
        c => c.type === 'npc' && c.name === npc.name
      );
      if (alreadyAdded) return;
      const roll = rollD20();
      const total = roll + initBonus;
      combatSummary.creatures.push({
        name: npc.name,
        type: 'npc',
        initiative: String(total),
        targetId: null,
        targetName: null,
        ac: npc.armorClass || 10,
        resistances: npc.damageResistances || [],
        immunities: npc.damageImmunities || [],
        conditions: [],
        concentration: null,
        imagePath: npc.imagePath || npc.image || '',
        initiativeBonus: initBonus,
      });
      combatSummary.creatures.sort((a, b) => b.initiative - a.initiative);
      localStorage.setItem('combatSummary', JSON.stringify(combatSummary));
      window.dispatchEvent(new CustomEvent('initiative-rolled'));

      fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'roll',
          characterName: npc.name,
          rollType: 'initiative',
          name: 'Initiative',
          rolls: [roll],
          total: roll,
          bonus: initBonus,
          mode: 'normal',
          isNatural20: roll === 20,
          isNatural1: roll === 1,
          timestamp: Date.now(),
          id: utils.guid(),
        }),
      }).catch(() => {});
      if (onViewInitiative) onViewInitiative();
    } catch (error) {
      console.error('Failed to add NPC to initiative:', error);
    }
  };

  const getAttitudeStyle = (attitude) => {
    const colors = ATTITUDE_COLORS[attitude] || ATTITUDE_COLORS.neutral;
    return {
      backgroundColor: colors.bg,
      color: colors.color,
      borderColor: colors.border,
    };
  };

  return (
    <div className="ct-container">
      <div className="ct-header">
        <button className="ct-back-btn" onClick={onBack}>
          <i className="fa-solid fa-arrow-left" /> Back
        </button>
        <h2 className="ct-title">
          <i className="fa-solid fa-users" /> NPCs
        </h2>
        <button className="ct-new-btn" onClick={handleNewNPC}>
          <i className="fa-solid fa-plus" /> New NPC
        </button>
      </div>

      <div className="ct-search-row">
        <i className="fa-solid fa-magnifying-glass ct-search-icon" />
        <input
          type="text"
          className="ct-search-input"
          placeholder="Search NPCs…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search NPCs"
        />
        {searchQuery && (
          <button
            className="ct-search-clear"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        )}
      </div>

      {loading && (
        <div className="ct-empty-state">
          <i className="fa-solid fa-spinner fa-spin" /> Loading NPCs…
        </div>
      )}

      {!loading && filteredNPCs.length === 0 && (
        <div className="ct-empty-state">
          {searchQuery ? (
            <>
              <i className="fa-solid fa-search" />
              No NPCs found matching &ldquo;{searchQuery}&rdquo;
            </>
          ) : (
            <>
              <i className="fa-solid fa-users" />
              No NPCs yet. Click &ldquo;New NPC&rdquo; to create one.
            </>
          )}
        </div>
      )}

      {!loading && filteredNPCs.length > 0 && (
        <ul className="ct-list">
          {filteredNPCs.map((npc) => (
            <li
              key={npc.name}
              className="ct-list-item"
              onClick={() => handleEditNPC(npc)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleEditNPC(npc);
                }
              }}
              aria-label={`Edit NPC: ${npc.name}`}
            >
              <div className="ct-list-item-header npcs-list-header">
                <div className="npcs-list-name-row">
                  {npc.imagePath && (
                    <AvatarImage name={npc.name} imagePath={npc.imagePath} size={36} />
                  )}
                  <span className="ct-list-name">{npc.name}</span>
                </div>
                <div className="ct-list-meta">
                  {npcHasStatBlock(npc) && (
                    <span className="npcs-stat-badge" title="Has stat block">
                      <i className="fa-solid fa-shield" />
                    </span>
                  )}
                  {npc.attitude && (
                    <span
                      className="ct-list-attitude npcs-list-attitude"
                      style={getAttitudeStyle(npc.attitude)}
                      title={npc.attitude}
                    >
                      {npc.attitude}
                    </span>
                  )}
                </div>
              </div>
              <div className="ct-list-details">
                {(npc.race || npc.classRole) && (
                  <span className="npcs-list-subtitle">
                    {npc.race && <span>{npc.race}</span>}
                    {npc.race && npc.classRole && <span className="npcs-list-separator"> / </span>}
                    {npc.classRole && <span>{npc.classRole}</span>}
                  </span>
                )}
                <div className="npcs-list-actions-row">
                  {npc.tags && (
                    <span className="npcs-list-tags">
                      <i className="fa-solid fa-tags" /> {npc.tags}
                    </span>
                  )}
                  {npcHasStatBlock(npc) && (
                    <button
                      className="npcs-init-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToInitiative(npc);
                      }}
                      title="Add to Initiative"
                    >
                      <i className="fa-solid fa-shield-alt" /> Add to Initiative
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && formData && (
        <div className="ct-modal-overlay">
          <div className="ct-modal npcs-modal">
            <div className="ct-modal-header no-print">
              <h3>{editingNPC ? 'Edit NPC' : 'New NPC'}</h3>
              <button
                className="ct-modal-close"
                onClick={handleCloseModal}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            {/* Avatar upload */}
            <div className="npcs-avatar-section no-print">
              <AvatarImage name={formData.name} imagePath={formData.image || formData.imagePath} size={80} onClick={(formData.image || formData.imagePath) ? () => setShowNpcAvatarModal(true) : undefined} />
              <div className="npcs-avatar-controls">
                <label className="ct-btn ct-btn-sm">
                  <i className="fa-solid fa-camera" /> Upload Avatar
                  <input
                    type="file"
                    accept="image/*"
                    className="npcs-avatar-input"
                    onChange={handleImageUpload}
                  />
                </label>
                {(formData.image || formData.imagePath) && (
                  <button className="ct-btn ct-btn-sm ct-btn-danger" onClick={handleRemoveImage}>
                    <i className="fa-solid fa-trash-can" /> Remove
                  </button>
                )}
              </div>
            </div>

            {/* Tab navigation */}
            <div className="npcs-tabs no-print">
              <button
                className={`npcs-tab ${activeTab === 'roleplay' ? 'npcs-tab-active' : ''}`}
                onClick={() => setActiveTab('roleplay')}
              >
                <i className="fa-solid fa-book" /> Roleplay
              </button>
              <button
                className={`npcs-tab ${activeTab === 'stats' ? 'npcs-tab-active' : ''}`}
                onClick={() => setActiveTab('stats')}
              >
                <i className="fa-solid fa-shield" /> Stats
              </button>
            </div>

            <div className="ct-modal-body">
              {/* Name (always visible) */}
              <label htmlFor="npc-name" className="ct-label">
                Name <span className="ct-required">*</span>
              </label>
              <input
                id="npc-name"
                type="text"
                className="ct-input"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                placeholder="NPC name"
                autoFocus
              />

              <div className={`npcs-roleplay-tab${activeTab !== 'roleplay' ? ' npcs-tab-hidden' : ''}`}>
                <label htmlFor="npc-race" className="ct-label">Race</label>
                <input
                  id="npc-race"
                  type="text"
                  className="ct-input"
                  value={formData.race}
                  onChange={(e) => handleFormChange('race', e.target.value)}
                  placeholder="e.g., Human, Elf, Dwarf"
                />

                <label htmlFor="npc-classRole" className="ct-label">Class / Role</label>
                <input
                  id="npc-classRole"
                  type="text"
                  className="ct-input"
                  value={formData.classRole}
                  onChange={(e) => handleFormChange('classRole', e.target.value)}
                  placeholder="e.g., Fighter, Wizard, Merchant"
                />

                <label htmlFor="npc-attitude" className="ct-label">Attitude</label>
                <select
                  id="npc-attitude"
                  className="ct-select"
                  value={formData.attitude}
                  onChange={(e) => handleFormChange('attitude', e.target.value)}
                >
                  {ATTITUDE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>

                <PreviewToggle
                  id="npc-appearance"
                  value={formData.appearance}
                  onChange={(value) => handleFormChange('appearance', value)}
                  placeholder="Physical description…"
                  label="Appearance"
                />
                <PreviewToggle
                  id="npc-personality"
                  value={formData.personality}
                  onChange={(value) => handleFormChange('personality', value)}
                  placeholder="Personality traits, ideals, bonds, flaws…"
                  label="Personality"
                />
                <PreviewToggle
                  id="npc-goals"
                  value={formData.goals}
                  onChange={(value) => handleFormChange('goals', value)}
                  placeholder="What does this NPC want?"
                  label="Goals"
                />
                <PreviewToggle
                  id="npc-secrets"
                  value={formData.secrets}
                  onChange={(value) => handleFormChange('secrets', value)}
                  placeholder="Hidden truths about this NPC…"
                  label="Secrets"
                />
                <PreviewToggle
                  id="npc-notes"
                  value={formData.notes}
                  onChange={(value) => handleFormChange('notes', value)}
                  placeholder="Additional notes…"
                  label="Notes"
                />

                <label htmlFor="npc-tags" className="ct-label">Tags (comma separated)</label>
                <input
                  id="npc-tags"
                  type="text"
                  className="ct-input"
                  value={formData.tags}
                  onChange={(e) => handleFormChange('tags', e.target.value)}
                  placeholder="e.g., ally, enemy, quest-giver"
                />
              </div>

              <div className={`npcs-stats-tab${activeTab !== 'stats' ? ' npcs-tab-hidden' : ''}`.trim()}>
                  <h4 className="npcs-section-title">Combat Stats</h4>
                  <div className="npcs-stats-grid">
                    <div className="npcs-stat-field">
                      <label>AC</label>
                      <input
                        type="number"
                        min="0"
                        className="ct-input"
                        value={formData.armorClass ?? ''}
                        onChange={(e) => handleFormChange('armorClass', e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="10"
                      />
                    </div>
                    <div className="npcs-stat-field">
                      <label>HP</label>
                      <input
                        type="text"
                        className="ct-input"
                        value={formData.hitPoints}
                        onChange={(e) => handleFormChange('hitPoints', e.target.value)}
                        placeholder="e.g., 45"
                      />
                    </div>
                    <div className="npcs-stat-field">
                      <label>Hit Dice</label>
                      <input
                        type="text"
                        className="ct-input"
                        value={formData.hitDice}
                        onChange={(e) => handleFormChange('hitDice', e.target.value)}
                        placeholder="e.g., 6d8"
                      />
                    </div>
                    <div className="npcs-stat-field">
                      <label>Speed</label>
                      <input
                        type="text"
                        className="ct-input"
                        value={formData.speed?.walk || ''}
                        onChange={(e) => handleFormChange('speed', { ...formData.speed, walk: e.target.value })}
                        placeholder="30 ft."
                      />
                    </div>
                    <div className="npcs-stat-field">
                      <label>Initiative Bonus</label>
                      <input
                        type="number"
                        className="ct-input"
                        value={formData.initiativeBonus}
                        onChange={(e) => handleFormChange('initiativeBonus', e.target.value)}
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
                    onChange={(e) => handleFormChange('traits', e.target.value)}
                    placeholder="Special traits (one per line or markdown)"
                    rows={3}
                  />

                  <h4 className="npcs-section-title">Reactions</h4>
                  <textarea
                    className="ct-textarea"
                    value={formData.reactions}
                    onChange={(e) => handleFormChange('reactions', e.target.value)}
                    placeholder="Reactions (one per line or markdown)"
                    rows={3}
                  />
                </div>
            </div>

            <div className="ct-modal-footer no-print">
              <div className="ct-modal-actions">
                {editingNPC && (
                  <button
                    className="ct-btn ct-btn-danger"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    <i className="fa-solid fa-trash-can" />{' '}
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              {npcHasStatBlock(formData) && (
                    <button
                      className="ct-btn"
                      onClick={async () => {
                        setSaving(true);
                        try {
                          const snapshot = { ...formData };
                          const cleaned = { ...snapshot };
                          if (cleaned.armorClass === null || cleaned.armorClass === undefined || cleaned.armorClass === '') {
                            delete cleaned.armorClass;
                          }
                          if (cleaned.armorClass === undefined) {
                            cleaned.armorClass = null;
                          }
                          const result = await saveNPCAction(cleaned);
                          const savedNpc = result?.npc || snapshot;
                          const imagePath = savedNpc.imagePath || snapshot.image || '';
                          handleCloseModal();
                          const initBonus = parseInt(snapshot.initiativeBonus) || 0;
                          const stored = localStorage.getItem('combatSummary');
                          let combatSummary = stored ? JSON.parse(stored) : null;
                          if (!combatSummary) {
                            combatSummary = { round: 1, creatures: [] };
                          }
                          const alreadyAdded = combatSummary.creatures.some(
                            c => c.type === 'npc' && c.name === snapshot.name
                          );
                          if (alreadyAdded) {
                            if (onViewInitiative) onViewInitiative();
                            return;
                          }
                          const roll = rollD20();
                          const total = roll + initBonus;
                          combatSummary.creatures.push({
                            name: snapshot.name,
                            type: 'npc',
                            initiative: String(total),
                            targetId: null,
                            targetName: null,
                            ac: snapshot.armorClass || 10,
                            resistances: snapshot.damageResistances || [],
                            immunities: snapshot.damageImmunities || [],
                            conditions: [],
                            concentration: null,
                            imagePath,
                            initiativeBonus: initBonus,
                          });
                          combatSummary.creatures.sort((a, b) => b.initiative - a.initiative);
                          localStorage.setItem('combatSummary', JSON.stringify(combatSummary));
                          window.dispatchEvent(new CustomEvent('initiative-rolled'));

                          fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              type: 'roll',
                              characterName: snapshot.name,
                              rollType: 'initiative',
                              name: 'Initiative',
                              rolls: [roll],
                              total: roll,
                              bonus: initBonus,
                              mode: 'normal',
                              isNatural20: roll === 20,
                              isNatural1: roll === 1,
                              timestamp: Date.now(),
                              id: utils.guid(),
                            }),
                          }).catch(() => {});
                        if (onViewInitiative) onViewInitiative();
                        } catch (error) {
                          console.error('Failed to save NPC:', error);
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving || !formData.name.trim()}
                      title="Save and add to initiative"
                    >
                      <i className="fa-solid fa-shield-alt" /> Save & Add to Initiative
                    </button>
                  )}
              </div>
              <div className="ct-modal-buttons">
                <button
                  className="ct-btn"
                  onClick={handleCloseModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="ct-btn ct-btn-primary"
                  onClick={handleSave}
                  disabled={saving || !formData.name.trim()}
                >
                  <i className="fa-solid fa-floppy-disk" />{' '}
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showNpcAvatarModal && formData && (formData.image || formData.imagePath) && (
        <AvatarModal
          name={formData.name}
          imagePath={formData.image || formData.imagePath}
          onClose={() => setShowNpcAvatarModal(false)}
        />
      )}
    </div>
  );
}

export default NPCs;
