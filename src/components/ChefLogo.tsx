import React from 'react';

interface ChefLogoProps {
  className?: string;
  size?: number | string;
}

export const ChefLogo: React.FC<ChefLogoProps> = ({ className = '', size = '100%' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} select-none`}
    >
      {/* Outer border & Shadow effects */}
      <defs>
        <radialGradient id="purpleBg" cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
          <stop offset="0%" stopColor="#6b1d55" />
          <stop offset="100%" stopColor="#431235" />
        </radialGradient>
        <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* Circle Background */}
      <circle cx="256" cy="256" r="240" fill="url(#purpleBg)" stroke="#fef08a" strokeWidth="6" filter="url(#shadow)" />

      {/* Chef Body/Jacket */}
      <path
        d="M 120 420 C 140 310, 372 310, 392 420 C 392 420, 360 480, 256 480 C 152 480, 120 420, 120 420 Z"
        fill="#ffffff"
        stroke="#1e1b1d"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* Jacket collar lines & buttons */}
      <path
        d="M 210 350 L 210 480 M 302 350 L 302 480 M 256 350 L 256 480"
        stroke="#e5e7eb"
        strokeWidth="3.5"
      />
      {/* Buttons */}
      <circle cx="225" cy="390" r="7" fill="#cbd5e1" stroke="#1e1b1d" strokeWidth="2.5" />
      <circle cx="225" cy="430" r="7" fill="#cbd5e1" stroke="#1e1b1d" strokeWidth="2.5" />
      <circle cx="287" cy="390" r="7" fill="#cbd5e1" stroke="#1e1b1d" strokeWidth="2.5" />
      <circle cx="287" cy="430" r="7" fill="#cbd5e1" stroke="#1e1b1d" strokeWidth="2.5" />

      {/* Red Neckerchief (Scarf) tied around the neck */}
      {/* Scarf collar ring wrapping the neck */}
      <path
        d="M 180 340 L 332 340 L 310 365 L 202 365 Z"
        fill="#dc2626"
        stroke="#1e1b1d"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
      {/* Tied Scarf Knot */}
      <circle cx="256" cy="365" r="14" fill="#ef4444" stroke="#1e1b1d" strokeWidth="4" />
      {/* Scarf tails flowing dynamically */}
      <path
        d="M 248 375 L 210 440 L 244 445 L 254 378 Z"
        fill="#b91c1c"
        stroke="#1e1b1d"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M 264 375 L 302 440 L 268 445 L 258 378 Z"
        fill="#dc2626"
        stroke="#1e1b1d"
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {/* Ears */}
      <circle cx="178" cy="225" r="18" fill="#ffd0a1" stroke="#1e1b1d" strokeWidth="4" />
      <circle cx="178" cy="225" r="8" fill="none" stroke="#e09d64" strokeWidth="2.5" />
      <circle cx="334" cy="225" r="18" fill="#ffd0a1" stroke="#1e1b1d" strokeWidth="4" />
      <circle cx="334" cy="225" r="8" fill="none" stroke="#e09d64" strokeWidth="2.5" />

      {/* Face/Head */}
      <path
        d="M 184 195 C 184 165, 328 165, 328 195 C 328 275, 305 315, 256 315 C 207 315, 184 275, 184 195 Z"
        fill="#ffd0a1"
        stroke="#1e1b1d"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />

      {/* Rosy cheeks */}
      <ellipse cx="205" cy="254" rx="14" ry="9" fill="#f43f5e" fillOpacity="0.25" />
      <ellipse cx="307" cy="254" rx="14" ry="9" fill="#f43f5e" fillOpacity="0.25" />

      {/* Eyes - Squinting smiling happy curves */}
      <path
        d="M 210 216 Q 224 204, 238 216"
        fill="none"
        stroke="#1e1b1d"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M 274 216 Q 288 204, 302 216"
        fill="none"
        stroke="#1e1b1d"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* Eyebrows */}
      <path
        d="M 204 198 Q 222 188, 240 198"
        fill="none"
        stroke="#1e1b1d"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M 272 198 Q 290 188, 308 198"
        fill="none"
        stroke="#1e1b1d"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Chubby Nose */}
      <path
        d="M 242 236 Q 256 244, 270 236"
        fill="none"
        stroke="#1e1b1d"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Big curly delicious black mustache */}
      <path
        d="M 256 250 C 242 248, 198 238, 186 260 C 176 278, 204 286, 222 278 C 240 270, 250 262, 256 258 C 262 262, 272 270, 290 278 C 308 286, 336 278, 326 260 C 314 238, 270 248, 256 250 Z"
        fill="#1e1b1d"
        stroke="#1e1b1d"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Smiling Mouth underneath mustache */}
      <path
        d="M 238 286 Q 256 300, 274 286"
        fill="none"
        stroke="#1e1b1d"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Puffy White Chef Hat (Blowing cloud-like at the top) */}
      <path
        d="M 188 165 C 158 140, 140 110, 170 80 C 180 50, 218 35, 256 50 C 294 35, 332 50, 342 80 C 372 110, 354 140, 324 165 Z"
        fill="#ffffff"
        stroke="#1e1b1d"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
      {/* Chef Hat inner crease lines for dimensions */}
      <path d="M 215 155 Q 212 90, 235 60" fill="none" stroke="#e5e7eb" strokeWidth="4" strokeLinecap="round" />
      <path d="M 256 158 V 65" fill="none" stroke="#e5e7eb" strokeWidth="4" strokeLinecap="round" />
      <path d="M 297 155 Q 300 90, 277 60" fill="none" stroke="#e5e7eb" strokeWidth="4" strokeLinecap="round" />

      {/* Hat brim base */}
      <path
        d="M 178 178 L 334 178 Q 344 158, 334 148 L 178 148 Q 168 158, 178 178 Z"
        fill="#ffffff"
        stroke="#1e1b1d"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />

      {/* Left Hand: OK gesture */}
      <g filter="url(#shadow)">
        {/* Arm */}
        <path d="M 85 365 C 100 325, 130 330, 145 350" fill="none" stroke="#1e1b1d" strokeWidth="5" />
        {/* Hand Base */}
        <path
          d="M 98 322 C 98 300, 110 290, 122 302 L 138 318 C 145 325, 140 338, 130 342 L 108 348 C 100 350, 98 335, 98 322 Z"
          fill="#ffd0a1"
          stroke="#1e1b1d"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        {/* Index finger and thumb forming OK ring */}
        <circle cx="114" cy="305" r="11" fill="none" stroke="#1e1b1d" strokeWidth="3.8" />
        {/* Fingers standing up (Middle, Ring, Pinky) */}
        {/* Middle */}
        <path d="M 90 296 C 82 284, 94 272, 102 284 C 106 290, 108 296, 110 300" fill="#ffd0a1" stroke="#1e1b1d" strokeWidth="4" />
        {/* Ring */}
        <path d="M 80 308 C 72 298, 84 286, 92 296" fill="#ffd0a1" stroke="#1e1b1d" strokeWidth="4" />
        {/* Pinky */}
        <path d="M 74 322 C 68 314, 78 304, 84 314" fill="#ffd0a1" stroke="#1e1b1d" strokeWidth="4" />
      </g>

      {/* Right Hand: OK gesture */}
      <g filter="url(#shadow)">
        {/* Arm */}
        <path d="M 427 365 C 412 325, 382 330, 367 350" fill="none" stroke="#1e1b1d" strokeWidth="5" />
        {/* Hand Base */}
        <path
          d="M 414 322 C 414 300, 402 290, 390 302 L 374 318 C 367 325, 372 338, 382 342 L 404 348 C 412 350, 414 335, 414 322 Z"
          fill="#ffd0a1"
          stroke="#1e1b1d"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        {/* Index finger and thumb forming OK ring */}
        <circle cx="398" cy="305" r="11" fill="none" stroke="#1e1b1d" strokeWidth="3.8" />
        {/* Fingers standing up (Middle, Ring, Pinky) */}
        {/* Middle */}
        <path d="M 422 296 C 430 284, 418 272, 410 284 C 406 290, 404 296, 402 300" fill="#ffd0a1" stroke="#1e1b1d" strokeWidth="4" />
        {/* Ring */}
        <path d="M 432 308 C 440 298, 428 286, 420 296" fill="#ffd0a1" stroke="#1e1b1d" strokeWidth="4" />
        {/* Pinky */}
        <path d="M 438 322 C 444 314, 434 304, 428 314" fill="#ffd0a1" stroke="#1e1b1d" strokeWidth="4" />
      </g>
    </svg>
  );
};
