import React, { useState, useEffect, useMemo } from 'react';
import WarningList from '../common/WarningList.jsx';
import './WizardStepSkills.css';
import { loadSkills } from '../../services/ui/dataLoader.js';
import { isEqual } from 'lodash';

// Feat-restricted skills can only use feat expertise slots
const getFeatSlotBlockReason = (expertiseData, expertiseLimits) => {
  if (!expertiseLimits?.featCount || expertiseLimits.featCount <= 0) {
    return 'This skill requires a feat expertise slot';
  }
  if (expertiseData.featSlotsUsed >= expertiseLimits.featCount) {
    return 'All feat expertise slots are used';
  }
  return null;
};

// Non-restricted skills can use class slots or feat slots
const getClassSlotBlockReason = (expertiseLimits) => {
  if (!expertiseLimits?.classCount || expertiseLimits.classCount <= 0) {
    if (!expertiseLimits?.featCount || expertiseLimits.featCount <= 0) {
      return 'This class does not grant expertise slots';
    }
    return 'All expertise slots are used';
  }
  return 'All class expertise slots are used';
};

const getExpertiseBlockReason = (skill, expertiseData, expertiseLimits) => {
  // Check if this skill is in a feat-restricted list
  const isFeatRestricted = expertiseLimits?.featExpertiseSkillLists?.some(list =>
    list.some(s => s.trim() === skill)
  );

  if (isFeatRestricted) {
    return getFeatSlotBlockReason(expertiseData, expertiseLimits);
  }

  const inClassList = !expertiseData.classRestrictedSkills || expertiseData.classRestrictedSkills.has(skill);
  const hasClassSlots = inClassList && expertiseLimits?.classCount && expertiseLimits.classCount > 0 && expertiseData.classSlotsAvailable > 0;
  const hasFeatSlots = expertiseLimits?.featCount && expertiseLimits.featCount > 0 && expertiseData.featSlotsUsed < expertiseLimits.featCount;

  if (!inClassList && !hasFeatSlots) {
    return `Class expertise is limited to: ${[...expertiseData.classRestrictedSkills].join(', ')}`;
  }
  if (hasClassSlots || hasFeatSlots) {
    return null;
  }
  return getClassSlotBlockReason(expertiseLimits);
};

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

const SkillLimitsInfo = ({ skillLimits, formData }) => (
	<div className="rule-info">
		<p className="skill-count-summary">
			<span className="skill-count-text">
				You have selected <strong>{formData.skillProficiencies?.length || 0}</strong> of <strong>{skillLimits.allowed}</strong> allowed skill proficiency/ies.
			</span>
		</p>
		{skillLimits.skillChoiceSources && skillLimits.skillChoiceSources.length > 0 && (() => {
			const selectedSkills = formData.skillProficiencies || [];
			const assignedSkills = new Set();
			const sourceAssignments = {};
			const skillSourceMap = new Map();

			skillLimits.skillChoiceSources.forEach(s => {
				sourceAssignments[s.source + '_' + (s.featName || '0')] = 0;
			});

			// Build map of which source each skill belongs to
			skillLimits.skillChoiceSources.forEach(source => {
				source.skills.forEach(skill => {
					if (!skillSourceMap.has(skill)) {
						skillSourceMap.set(skill, []);
					}
					skillSourceMap.get(skill).push(source);
				});
			});

			// Greedy assignment algorithm
			const remainingSkills = [...selectedSkills];
			const assignments = [];

			while (remainingSkills.length > 0) {
				let bestSource = null;
				let bestSize = Infinity;

				skillLimits.skillChoiceSources.forEach(source => {
					const key = source.source + '_' + (source.featName || '0');
					const remainingCapacity = source.count - sourceAssignments[key];
					if (remainingCapacity <= 0) return;
					const unassignedInPool = remainingSkills.filter(s =>
						source.skills.includes(s) && !assignedSkills.has(s)
					);
					if (unassignedInPool.length > 0 && source.skills.length < bestSize) {
						bestSource = source;
						bestSize = source.skills.length;
					}
				});

				if (!bestSource) break;

				const assigned = remainingSkills.find(s =>
					bestSource.skills.includes(s) && !assignedSkills.has(s)
				);
				if (!assigned) break;

				const key = bestSource.source + '_' + (bestSource.featName || '0');
				sourceAssignments[key]++;
				assignedSkills.add(assigned);
				const idx = remainingSkills.indexOf(assigned);
				remainingSkills.splice(idx, 1);
				assignments.push({ source: bestSource, skill: assigned });
			}

			// Count assignments per source
			const assignmentMap = {};
			assignments.forEach(a => {
				const key = a.source.source + '_' + (a.source.featName || '0');
				if (!assignmentMap[key]) assignmentMap[key] = 0;
				assignmentMap[key]++;
			});

			// Determine which skills come from Skilled
			const skilledSkills = [];
			selectedSkills.forEach(skill => {
				if (!assignedSkills.has(skill)) {
					skilledSkills.push(skill);
				}
			});

			const skilledUsesAvailable = skillLimits.skilledUsesAvailable || 0;
			const skilledUsesUsed = skillLimits.skilledUsesUsed || 0;

			return (
				<>
					{skilledUsesAvailable > 0 && (
						<div className="breakdown-source skilled-source">
							<span className="breakdown-source-label">
								Skilled: {skilledUsesUsed} of {skilledUsesAvailable}
							</span>
							<span className="breakdown-source-skills">
								{skilledSkills.length > 0 ? skilledSkills.join(', ') : 'None selected'}
							</span>
						</div>
					)}
					{skillLimits.skillChoiceSources.map((source, idx) => {
						const key = source.source + '_' + (source.featName || '0');
						const selectedFromSource = assignmentMap[key] || 0;
						const sourceLabel = source.featName || source.source.charAt(0).toUpperCase() + source.source.slice(1);
						return (
							<div key={idx} className="breakdown-source">
								<span className="breakdown-source-label">
									{sourceLabel}: {selectedFromSource} of {source.count}
								</span>
								<span className="breakdown-source-skills">
									{source.skills.join(', ')}
								</span>
							</div>
						);
					})}
				</>
			);
		})()}
		{skillLimits.details && (!skillLimits.skillChoiceSources || skillLimits.skillChoiceSources.length === 0) && (
			<p><strong>Rules:</strong> {skillLimits.details}</p>
		)}
	</div>
);

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

  const expertiseData = useMemo(() => {
    const expertSkills = formData.expertSkills || [];
    const featExpertiseSkillLists = expertiseLimits?.featExpertiseSkillLists;
    const classExpertiseSkillLists = expertiseLimits?.classExpertiseSkillLists;

    // Build the set of feat-restricted skill names
    let featRestrictedSkills = null;
    if (featExpertiseSkillLists && featExpertiseSkillLists.length > 0) {
      featRestrictedSkills = new Set(
        featExpertiseSkillLists.flat().map(s => s.trim()).filter(Boolean)
      );
    }

    // Build the set of class-restricted skill names (e.g., Scholar's six skills)
    let classRestrictedSkills = null;
    if (classExpertiseSkillLists && classExpertiseSkillLists.length > 0) {
      classRestrictedSkills = new Set(
        classExpertiseSkillLists.flat().map(s => s.trim()).filter(Boolean)
      );
    }

    // Count how many expert skills are in the restricted set (feat slots used)
    const featSlotsUsed = featRestrictedSkills
      ? expertSkills.filter(s => featRestrictedSkills.has(s)).length
      : 0;

    // Class-based expertise slots available
    const classSlotsAvailable = (expertiseLimits?.classCount || 0) - expertSkills.length + featSlotsUsed;

    return {
      featRestrictedSkills,
      classRestrictedSkills,
      featSlotsUsed,
      featCount: expertiseLimits?.featCount || 0,
      classSlotsAvailable,
    };
  }, [formData.expertSkills, expertiseLimits]);

	const showExpertiseFeedbackFor = (message) => {
		setShowExpertiseFeedback(message);
		setTimeout(() => setShowExpertiseFeedback(null), 3000);
	};

	const handleExpertiseToggle = (skill) => {
		const isCurrentlyExpert = (formData.expertSkills || []).includes(skill);

		if (isCurrentlyExpert) {
			// Deselecting expertise - remove from expertSkills only
			onSkillExpertiseToggle(skill, false);
			setShowExpertiseFeedback(null);
			return;
		}

		// Elevating to expertise
		if (!(formData.skillProficiencies || []).includes(skill)) {
			showExpertiseFeedbackFor(`Please select ${skill} as proficient first`);
			return;
		}

		const blockReason = getExpertiseBlockReason(skill, expertiseData, expertiseLimits);
		if (blockReason) {
			showExpertiseFeedbackFor(blockReason);
			return;
		}

		onSkillExpertiseToggle(skill, true);
		showExpertiseFeedbackFor(`${skill} is now Expert!`);
	};

	const isSkillExpert = (skill) => (formData.expertSkills || []).includes(skill);
	const isSkillProficient = (skill) => (formData.skillProficiencies || []).includes(skill);
	const expertiseButtonTitle = (skill) => {
		if (isSkillExpert(skill)) return 'Click to remove Expert status';
		if (!isSkillProficient(skill)) return 'Select proficient first';
		return 'Click to elevate to Expert';
	};
	const handleProficiencyToggle = (skill) => {
		const isCurrentlyProficient = (formData.skillProficiencies || []).includes(skill);
		const isCurrentlyExpert = (formData.expertSkills || []).includes(skill);

		if (!isCurrentlyProficient) {
			onSkillToggle(skill);
		} else {
			onSkillToggle(skill);
			if (isCurrentlyExpert) {
				onSkillExpertiseToggle(skill, false);
			}
		}
	};
	const isPreSelected = (skill) => (preSelectedSkills || []).includes(skill);

	return (
		<div className="wizard-step wizard-step-skills">
			<h2>Step 6: Skill Proficiencies</h2>

			{/* Display skill limits info with breakdown */}
			{skillLimits && <SkillLimitsInfo skillLimits={skillLimits} formData={formData} />}

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
							onChange={() => handleProficiencyToggle(skill.name)}
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
							disabled={isSkillExpert(skill.name) ? false : !isSkillProficient(skill.name)}
							title={expertiseButtonTitle(skill.name)}
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
