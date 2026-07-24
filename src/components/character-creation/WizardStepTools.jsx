import React, { useState, useEffect, useCallback, useMemo } from 'react';
import WarningList from '../common/WarningList.jsx';
import { getToolsByCategory } from '../../services/character/toolValidation.js';
import './WizardStepTools.css';

const ABILITY_ABBREVIATIONS = {
    Strength: 'STR',
    Dexterity: 'DEX',
    Constitution: 'CON',
    Intelligence: 'INT',
    Wisdom: 'WIS',
    Charisma: 'CHA',
};

const areEqual = (prevProps, nextProps) => {
    return (
        prevProps.formData === nextProps.formData &&
        prevProps.errors === nextProps.errors &&
        prevProps.onToolToggle === nextProps.onToolToggle &&
        prevProps.toolLimits === nextProps.toolLimits &&
        prevProps.toolWarnings === nextProps.toolWarnings &&
        prevProps.preSelectedTools === nextProps.preSelectedTools
    );
};

function WizardStepTools({ formData, errors, onToolToggle, toolLimits, toolWarnings, preSelectedTools }) {
    const [allTools, setAllTools] = useState([]);
    const [toolCategories, setToolCategories] = useState([]);

    const tools = useMemo(() => formData.toolProficiencies || [], [formData.toolProficiencies]);
    const preSelected = useMemo(() => preSelectedTools || [], [preSelectedTools]);

    useEffect(() => {
        const loadTools = async () => {
            const categories = ["Artisan's Tools", 'Gaming Sets', 'Musical Instrument', 'Other Tools'];
            const all = [];
            for (const cat of categories) {
                const toolsInCat = await getToolsByCategory(cat);
                for (const tool of toolsInCat) {
                    all.push({ ...tool, _category: cat });
                }
            }
            setToolCategories(categories);
            setAllTools(all);
        };
        loadTools();
    }, []);

    const isToolSelected = useCallback(
        (toolName) => tools.includes(toolName),
        [tools]
    );

    const isToolPreSelected = useCallback(
        (toolName) => preSelected.includes(toolName),
        [preSelected]
    );

    const handleToolToggle = useCallback(
        (toolName) => {
            if (isToolPreSelected(toolName) && isToolSelected(toolName)) {
                return;
            }
            onToolToggle(toolName);
        },
        [onToolToggle, isToolPreSelected, isToolSelected]
    );

    return (
        <div className="wizard-step wizard-step-tools">
            <h2>Step 11: Tool Proficiencies</h2>

            {toolLimits && (
                <div className="rule-info">
                    <p><strong>Rules:</strong> {toolLimits.details}</p>
                    <p>You have selected {tools.length} tool proficiency/ies ({preSelected.length} pre-selected, {tools.length - preSelected.length} chosen).</p>
                </div>
            )}

            {toolWarnings && toolWarnings.length > 0 && <WarningList warnings={toolWarnings} />}

            {toolCategories.length > 0 && (
                <div className="form-group">
                    <label>Tool Proficiencies</label>
                    {toolCategories.map(category => {
                        const toolsInCategory = allTools.filter(t => t._category === category);
                        return (
                            <div key={category} className="tool-category-section">
                                <h3 className="tool-category-header">{category}</h3>
                                <div className="multi-select-container multi-select-compact">
                                    {toolsInCategory.map(tool => (
                                        <label
                                            key={tool.name}
                                            className={`multi-select-item tool-card ${isToolSelected(tool.name) ? 'selected' : ''} ${isToolPreSelected(tool.name) ? 'pre-selected' : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isToolSelected(tool.name)}
                                                onChange={() => handleToolToggle(tool.name)}
                                                disabled={isToolPreSelected(tool.name) && isToolSelected(tool.name)}
                                            />
                                            <span className="tool-card-header">
                                                <span className="tool-name">{tool.name}</span>
                                                {tool.ability && (
                                                    <span className="tool-ability-badge">
                                                        {ABILITY_ABBREVIATIONS[tool.ability] || tool.ability}
                                                    </span>
                                                )}
                                            </span>
                                            {isToolSelected(tool.name) && (
                                                <div className="tool-card-details">
                                                    {tool.utilize && <div className="tool-utilize">Utilize: {tool.utilize}</div>}
                                                    {tool.craft && <div className="tool-craft">Craft: {tool.craft}</div>}
                                                </div>
                                            )}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {errors.toolProficiencies && <span className="error-message">{errors.toolProficiencies}</span>}
        </div>
    );
}

export default React.memo(WizardStepTools, areEqual);
