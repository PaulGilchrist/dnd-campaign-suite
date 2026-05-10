import React, { useState, useEffect } from 'react';
import WarningList from '../common/warning-list.jsx';
import './wizard-step-skills.css';
import { loadSkills } from '../../services/data-loader.js';
import { isEqual } from 'lodash';

const areEqual = (prevProps, nextProps) => {
  return (
    prevProps.formData === nextProps.formData &&
    prevProps.errors === nextProps.errors &&
    prevProps.onSkillToggle === nextProps.onSkillToggle &&
    prevProps.onSkillExpertiseToggle === nextProps.onSkillExpertiseToggle &&
    isEqual(prevProps.skillLimits, nextProps.skillLimits) &&
    isEqual(prevProps.expertiseLimits, nextProps.expertiseLimits) &&
    isEqual(prevProps.warnings, nextProps.warnings) &&
    isEqual(prevProps.preSelectedSkills, nextProps.preSelectedSkills)
  );
};

const WizardStepSkills = React.memo(function WizardStepSkills({ formData, errors, onSkillToggle, onSkillExpertiseToggle, skillLimits, expertiseLimits, warnings, preSelectedSkills }) {
  const [showExpertiseFeedback, setShowExpertiseFeedback] = useState(null);
	const [skills, setSkills] = useState([]);

	useEffect(() => {
		const loadSkillsData = async () => {
			const skillsData = await loadSkills();
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
		{warnings && warnings.length > 0 && <WarningList warnings={warnings} />}

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
							disabled={isPreSelected(skill.name) && isSkillProficient(skill.name)}
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
							disabled={!isSkillProficient(skill.name)}
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
}, areEqual);

export default WizardStepSkills;
