import React from "react";

const CitySVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Ground shadow */}
        <ellipse cx="18" cy="33" rx="17" ry="5" fill="#555" opacity="0.12" />

        {/* City wall - main curtain wall spanning full width */}
        <rect x="1" y="24" width="34" height="10" rx="1" fill="#9E9E9E" stroke="#757575" strokeWidth="0.8" />

        {/* Wall shadow (bottom) */}
        <rect x="1" y="31" width="34" height="3" rx="0.5" fill="#757575" opacity="0.4" />

        {/* Wall stone texture - horizontal lines */}
        <line x1="1" y1="27" x2="35" y2="27" stroke="#888" strokeWidth="0.3" opacity="0.4" />
        <line x1="1" y1="30" x2="35" y2="30" stroke="#888" strokeWidth="0.3" opacity="0.4" />

        {/* Wall crenellations (merlons) - full width */}
        <rect x="1" y="21" width="4" height="3" rx="0.2" fill="#9E9E9E" stroke="#757575" strokeWidth="0.4" />
        <rect x="7" y="21" width="4" height="3" rx="0.2" fill="#9E9E9E" stroke="#757575" strokeWidth="0.4" />
        <rect x="13" y="21" width="4" height="3" rx="0.2" fill="#9E9E9E" stroke="#757575" strokeWidth="0.4" />
        <rect x="19" y="21" width="4" height="3" rx="0.2" fill="#9E9E9E" stroke="#757575" strokeWidth="0.4" />
        <rect x="25" y="21" width="4" height="3" rx="0.2" fill="#9E9E9E" stroke="#757575" strokeWidth="0.4" />
        <rect x="31" y="21" width="4" height="3" rx="0.2" fill="#9E9E9E" stroke="#757575" strokeWidth="0.4" />
        {/* Crenel gaps */}
        <rect x="5" y="22" width="2" height="2" fill="#757575" />
        <rect x="11" y="22" width="2" height="2" fill="#757575" />
        <rect x="17" y="22" width="2" height="2" fill="#757575" />
        <rect x="23" y="22" width="2" height="2" fill="#757575" />
        <rect x="29" y="22" width="2" height="2" fill="#757575" />

        {/* Wall highlight top edges */}
        <rect x="1" y="21" width="4" height="0.5" fill="#BDBDBD" opacity="0.4" rx="0.1" />
        <rect x="7" y="21" width="4" height="0.5" fill="#BDBDBD" opacity="0.4" rx="0.1" />
        <rect x="13" y="21" width="4" height="0.5" fill="#BDBDBD" opacity="0.4" rx="0.1" />
        <rect x="19" y="21" width="4" height="0.5" fill="#BDBDBD" opacity="0.4" rx="0.1" />
        <rect x="25" y="21" width="4" height="0.5" fill="#BDBDBD" opacity="0.4" rx="0.1" />
        <rect x="31" y="21" width="4" height="0.5" fill="#BDBDBD" opacity="0.4" rx="0.1" />

        {/* Left corner tower */}
        <rect x="0" y="15" width="6" height="9" rx="0.5" fill="#8A8A8A" stroke="#757575" strokeWidth="0.5" />
        {/* Left tower crenellations */}
        <rect x="0" y="12" width="2" height="3" rx="0.2" fill="#8A8A8A" stroke="#757575" strokeWidth="0.3" />
        <rect x="4" y="12" width="2" height="3" rx="0.2" fill="#8A8A8A" stroke="#757575" strokeWidth="0.3" />
        {/* Left tower crenel gap */}
        <rect x="2" y="13" width="2" height="2" fill="#757575" />
        {/* Left tower window */}
        <rect x="2" y="17" width="1.5" height="2" rx="0.2" fill="#444" />

        {/* Right corner tower */}
        <rect x="30" y="15" width="6" height="9" rx="0.5" fill="#8A8A8A" stroke="#757575" strokeWidth="0.5" />
        {/* Right tower crenellations */}
        <rect x="30" y="12" width="2" height="3" rx="0.2" fill="#8A8A8A" stroke="#757575" strokeWidth="0.3" />
        <rect x="34" y="12" width="2" height="3" rx="0.2" fill="#8A8A8A" stroke="#757575" strokeWidth="0.3" />
        {/* Right tower crenel gap */}
        <rect x="32" y="13" width="2" height="2" fill="#757575" />
        {/* Right tower window */}
        <rect x="32.5" y="17" width="1.5" height="2" rx="0.2" fill="#444" />

        {/* Gatehouse / archway entrance */}
        <rect x="12" y="28" width="12" height="6" rx="0.5" fill="#6E6E6E" stroke="#555" strokeWidth="0.4" />
        {/* Gate arch */}
        <path d="M 15 34 L 15 29 Q 15 26 18 26 Q 21 26 21 29 L 21 34" fill="#333" stroke="#555" strokeWidth="0.5" />
        {/* Gate portcullis lines */}
        <line x1="15" y1="27" x2="15" y2="34" stroke="#555" strokeWidth="0.3" />
        <line x1="16.5" y1="26.5" x2="16.5" y2="34" stroke="#555" strokeWidth="0.3" />
        <line x1="18" y1="26" x2="18" y2="34" stroke="#555" strokeWidth="0.3" />
        <line x1="19.5" y1="26.5" x2="19.5" y2="34" stroke="#555" strokeWidth="0.3" />
        <line x1="21" y1="27" x2="21" y2="34" stroke="#555" strokeWidth="0.3" />
        {/* Portcullis crossbar */}
        <line x1="15" y1="30" x2="21" y2="30" stroke="#666" strokeWidth="0.5" />

        {/* Central keep / castle - main tower (taller) */}
        <rect x="11" y="4" width="14" height="18" rx="0.5" fill="#A8A8A8" stroke="#757575" strokeWidth="0.6" />
        {/* Keep left shadow */}
        <rect x="11" y="4" width="3" height="18" rx="0.3" fill="#757575" opacity="0.3" />
        {/* Keep right highlight */}
        <rect x="23" y="4" width="2" height="18" rx="0.3" fill="#BDBDBD" opacity="0.25" />

        {/* Keep stone lines */}
        <line x1="11" y1="9" x2="25" y2="9" stroke="#888" strokeWidth="0.3" opacity="0.35" />
        <line x1="11" y1="14" x2="25" y2="14" stroke="#888" strokeWidth="0.3" opacity="0.35" />
        <line x1="11" y1="19" x2="25" y2="19" stroke="#888" strokeWidth="0.3" opacity="0.35" />

        {/* Keep crenellations */}
        <rect x="11" y="1" width="3" height="3" rx="0.15" fill="#A8A8A8" stroke="#757575" strokeWidth="0.4" />
        <rect x="16" y="1" width="3" height="3" rx="0.15" fill="#A8A8A8" stroke="#757575" strokeWidth="0.4" />
        <rect x="21" y="1" width="3" height="3" rx="0.15" fill="#A8A8A8" stroke="#757575" strokeWidth="0.4" />
        {/* Keep crenel gaps */}
        <rect x="14" y="2" width="2" height="2" fill="#757575" />
        <rect x="19" y="2" width="2" height="2" fill="#757575" />

        {/* Keep windows */}
        <rect x="14" y="8" width="2" height="3" rx="0.2" fill="#444" />
        <rect x="20" y="8" width="2" height="3" rx="0.2" fill="#444" />
        <rect x="16.5" y="14" width="3" height="4" rx="0.3" fill="#444" />
        <rect x="16.5" y="14" width="3" height="0.8" fill="#A8A8A8" opacity="0.3" rx="0.1" />

        {/* Keep spire / roof */}
        <polygon points="13,1 18,-3 23,1" fill="#6B3E1F" stroke="#5A2E10" strokeWidth="0.5" strokeLinejoin="round" />
        {/* Spire highlight */}
        <polygon points="15.5,-0.5 18,-2.5 20.5,-0.5" fill="#7A4E28" opacity="0.3" />

        {/* Building behind wall (left, bigger) */}
        <rect x="4" y="16" width="8" height="8" rx="0.4" fill="#C49A6C" stroke="#8B5A2B" strokeWidth="0.5" />
        <polygon points="3,16 8,10 13,16" fill="#6B3E1F" stroke="#5A2E10" strokeWidth="0.4" strokeLinejoin="round" />
        {/* Roof highlight */}
        <polygon points="6,14 8,11 10,14" fill="#7A4E28" opacity="0.25" />
        {/* Windows */}
        <rect x="6" y="18" width="1.5" height="1.5" rx="0.15" fill="#F5D060" opacity="0.4" />
        <rect x="9" y="18" width="1.5" height="1.5" rx="0.15" fill="#F5D060" opacity="0.3" />
        {/* Door */}
        <rect x="7" y="22" width="2" height="2" rx="0.2" fill="#5A2E10" />

        {/* Building behind wall (right, bigger) */}
        <rect x="24" y="15" width="8" height="9" rx="0.4" fill="#B8925C" stroke="#8B5A2B" strokeWidth="0.5" />
        <polygon points="23,15 28,9 33,15" fill="#6B3E1F" stroke="#5A2E10" strokeWidth="0.4" strokeLinejoin="round" />
        {/* Roof highlight */}
        <polygon points="26,13 28,10 30,13" fill="#7A4E28" opacity="0.25" />
        {/* Windows */}
        <rect x="26" y="17" width="1.5" height="1.5" rx="0.15" fill="#F5D060" opacity="0.4" />
        <rect x="29" y="17" width="1.5" height="1.5" rx="0.15" fill="#F5D060" opacity="0.3" />
        {/* Door */}
        <rect x="27" y="22" width="2" height="2" rx="0.2" fill="#5A2E10" />

        {/* Small turret between keep and left wall */}
        <rect x="8" y="12" width="5" height="8" rx="0.4" fill="#9E9E9E" stroke="#757575" strokeWidth="0.4" />
        <polygon points="8,12 10.5,8 13,12" fill="#6B3E1F" stroke="#5A2E10" strokeWidth="0.3" strokeLinejoin="round" />
        <rect x="10" y="14" width="1.5" height="2" rx="0.15" fill="#444" />

        {/* Small turret between keep and right wall */}
        <rect x="23" y="13" width="5" height="7" rx="0.4" fill="#9E9E9E" stroke="#757575" strokeWidth="0.4" />
        <polygon points="23,13 25.5,10 28,13" fill="#6B3E1F" stroke="#5A2E10" strokeWidth="0.3" strokeLinejoin="round" />
        <rect x="24.5" y="15" width="1.5" height="2" rx="0.15" fill="#444" />
    </g>
));

CitySVG.displayName = "CitySVG";

export default CitySVG;
