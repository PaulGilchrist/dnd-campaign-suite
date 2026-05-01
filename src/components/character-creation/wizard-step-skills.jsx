import React, { useState, useEffect } from 'react';
import './wizard-step-skills.css';
import { validateSkills, getSkillLimits, getExpertiseLimits } from '../../services/skill-validation.js';

// Load skills from public/data/ability-scores.json
const loadSkills = async () => {
	try {
		const response = await fetch('/data/ability-scores.json');
		if (response.ok) {
			const abilities = await response.json();
			const skills = [];
			abilities.forEach(ability => {
				ability.skills.forEach(skillName => {
					skills.push({ name: skillName, ability: ability.full_name });
				});
			});
			return skills;
		}
	} catch (error) {
		console.error('Error loading skills:', error);
	}
	// Fallback
	return [
		{ name: 'Acrobatics', ability: 'Dexterity' },
		{ name: 'Animal Handling', ability: 'Wisdom' },
		{ name: 'Arcana', ability: 'Intelligence' },
		{ name: 'Athletics', ability: 'Strength' },
		{ name: 'Deception', ability: 'Charisma' },
		{ name: 'History', ability: 'Intelligence' },
		{ name: 'Insight', ability: 'Wisdom' },
		{ name: 'Intimidation', ability: 'Charisma' },
		{ name: 'Investigation', ability: 'Intelligence' },
		{ name: 'Medicine', ability: 'Wisdom' },
		{ name: 'Nature', ability: 'Intelligence' },
		{ name: 'Perception', ability: 'Wisdom' },
		{ name: 'Performance', ability: 'Charisma' },
		{ name: 'Persuasion', ability: 'Charisma' },
		{ name: 'Religion', ability: 'Intelligence' },
		{ name: 'Sleight of Hand', ability: 'Dexterity' },
		{ name: 'Stealth', ability: 'Dexterity' },
		{ name: 'Survival', ability: 'Wisdom' }
	];
};

let cachedSkills = null;

const getSkills = async () => {
	if (cachedSkills) {
		return cachedSkills;
	}
	cachedSkills = await loadSkills();
	return cachedSkills;
};

function WizardStepSkills({ formData, errors, onSkillToggle, onSkillExpertiseToggle, skillLimits, expertiseLimits, warnings, preSelectedSkills }) {
  const [showExpertiseFeedback, setShowExpertiseFeedback] = useState(null);
	const [skills, setSkills] = useState([]);

	useEffect(() => {
		const loadSkillsData = async () => {
			const skillsData = await getSkills();
			setSkills(skillsData);
		};
		loadSkillsData();
	}, []);

	const handleExpertiseToggle = (skill) => {
		const isCurrentlyExpert = (formData.expertSkills || []).includes(skill);
		const isCurrentlyProficient = (formData.skillProficiencies || []).includes(skill);

		if (isCurrentlyExpert) {
		 // Deselecting expertise - remove from expertSkills only
			onSkillExpertiseToggle(skill, false);
			setShowExpertiseFeedback(null);
		} else {
			// Elevating to expertise
			if (!isCurrentlyProficient) {
				setShowExpertiseFeedback(`Please select ${skill} as proficient first`);
				setTimeout(() => setShowExpertiseFeedback(null), 3000);
				return;
			}
			onSkillExpertiseToggle(skill, true);
			setShowExpertiseFeedback(`${skill} is now Expert!`);
			setTimeout(() => setShowExpertiseFeedback(null), 3000);
		}
	};

	const isSkillExpert = (skill) => (formData.expertSkills || []).includes(skill);
	const isSkillProficient = (skill) => (formData.skillProficiencies || []).includes(skill);
	const isPreSelected = (skill) => (preSelectedSkills || []).includes(skill);

	return (
		<div className="wizard-step">
			<h2>Step 6: Skill Proficiencies</h2>

			{/* Display skill limits info */}
			{skillLimits && (
				<div className="rule-info">
					<p><strong>Rules:</strong> {skillLimits.details}</p>
					<p>You have selected {formData.skillProficiencies?.length || 0} of {skillLimits.allowed} allowed skill proficiency/ies.</p>
				</div>
			)}

			{/* Display expertise info */}
			{expertiseLimits && expertiseLimits.allowed && (
				<div className="rule-info">
					<p><strong>Expertise:</strong> {expertiseLimits.details}</p>
					<p>You have expertise in {formData.expertSkills?.length || 0} of {expertiseLimits.count} allowed skill(s).</p>
				</div>
			)}

			{/* Display warnings if any */}
			{warnings && warnings.length > 0 && (
				<div className="warning-container">
					{warnings.map((warning, index) => (
						<div key={index} className={`warning-message ${warning.type}`}>
							{warning.message}
						</div>
					))}
				</div>
			)}

			<div className="form-group">
				<label>Skill Proficiencies</label>
				<div className="multi-select-container multi-select-compact">
					{skills.map(skill => (
						<label
							key={skill.name}
							className={`multi-select-item ${(formData.skillProficiencies || []).includes(skill.name) ? 'selected' : ''} ${isPreSelected(skill.name) ? 'pre-selected' : ''}`}
						>
							<input
								type="checkbox"
								checked={isSkillProficient(skill.name)}
								onChange={() => onSkillToggle(skill.name)}
								disabled={isPreSelected(skill.name)}
							/>
							&nbsp;
							<span className={isSkillExpert(skill.name) ? 'skill-expert-label' : ''}>
								{skill.name}
								{isSkillExpert(skill.name) && (
									<span className="expertise-indicator"> (Expert)</span>
								)}
							</span>
							<button
								type="button"
								className={`expertise-toggle-btn ${isSkillExpert(skill.name) ? 'active' : ''}`}
								onClick={() => handleExpertiseToggle(skill.name)}
								disabled={!isSkillProficient(skill.name) || (!expertiseLimits?.allowed && !isSkillExpert(skill.name))}
								title={isSkillProficient(skill.name) ? 'Click to elevate to Expert' : 'Select proficient first'}
							>
								{isSkillExpert(skill.name) ? '✓ Expert' : 'Elevate'}
							</button>
						</label>
					))}
				</div>
				{errors.skillProficiencies && <span className="error-message">{errors.skillProficiencies}</span>}
			</div>

			{showExpertiseFeedback && (
				<div className={`expertise-feedback ${showExpertiseFeedback.includes('Expert') ? 'success' : 'error'}`}>
					{showExpertiseFeedback}
				</div>
			)}
		</div>
	);
}

export default WizardStepSkills;

