import { useEffect, useRef } from 'react';
import { TOOL_NONE, TOOL_TRAVEL } from '../../../config/outdoorConfig.js';

function useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool) {
    const toolInitRef = useRef(true);
    const prevToolRef = useRef(tool);

    useEffect(() => {
        if (toolInitRef.current) {
            toolInitRef.current = false;
            prevToolRef.current = tool;
            return;
        }
        const toolJustActivated = tool === TOOL_TRAVEL && prevToolRef.current !== TOOL_TRAVEL;
        prevToolRef.current = tool;

        if (toolJustActivated && travelMgmt.travelMode === 'inactive') {
            travelMgmt.startPlanning();
            handleGenerateWeather();
        } else if (travelMgmt.travelMode === 'inactive' && tool === TOOL_TRAVEL) {
            // Domain rule: the travel tool may stay selected only while travel is
            // live — if travel goes inactive mid-selection, force the tool off.
            setTool(TOOL_NONE);
        } else if (tool !== TOOL_TRAVEL && travelMgmt.isTravelActive) {
            travelMgmt.cancelTravel();
        }
    }, [tool, handleGenerateWeather, travelMgmt, setTool]);
}

export default useTravelToolSync;
