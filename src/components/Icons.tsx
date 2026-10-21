import type { SVGProps } from "react";

type IconProps = { size?: number } & SVGProps<SVGSVGElement>;

const svg = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true });
const stroke = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const CalendarIcon = ({ size = 26, ...p }: IconProps) => (
  <svg {...svg(size)} fill="currentColor" {...p}>
    <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1zm13 8H4v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1z" />
  </svg>
);

export const PinIcon = ({ size = 26, ...p }: IconProps) => (
  <svg {...svg(size)} {...stroke} strokeWidth={1.8} {...p}>
    <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" />
    <circle cx="12" cy="9" r="2.5" />
  </svg>
);

export const PinFilledIcon = ({ size = 16, ...p }: IconProps) => (
  <svg {...svg(size)} fill="currentColor" {...p}>
    <path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zm0-9a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
  </svg>
);

export const ChatIcon = ({ size = 26, ...p }: IconProps) => (
  <svg {...svg(size)} {...stroke} strokeWidth={1.8} {...p}>
    <path d="M4 4h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    <path d="M20 9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2v2.5L17 19h-5" />
  </svg>
);

export const ChatFilledIcon = ({ size = 16, ...p }: IconProps) => (
  <svg {...svg(size)} fill="currentColor" {...p}>
    <path d="M4 3h13a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H10l-5 4v-4H4a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" />
  </svg>
);

export const ChartIcon = ({ size = 26, ...p }: IconProps) => (
  <svg {...svg(size)} {...stroke} strokeWidth={2.4} {...p}>
    <path d="M5 20v-7M12 20V5M19 20v-10" />
  </svg>
);

export const ChevronRightIcon = ({ size = 12, ...p }: IconProps) => (
  <svg {...svg(size)} {...stroke} strokeWidth={3.5} {...p}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);

export const ChevronLeftIcon = ({ size = 20, ...p }: IconProps) => (
  <svg {...svg(size)} {...stroke} strokeWidth={2.6} {...p}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const CloseIcon = ({ size = 12, ...p }: IconProps) => (
  <svg {...svg(size)} {...stroke} strokeWidth={3.5} {...p}>
    <path d="M5 5l14 14M19 5L5 19" />
  </svg>
);

export const SpeakerIcon = ({ size = 20, ...p }: IconProps) => (
  <svg {...svg(size)} fill="currentColor" {...p}>
    <path d="M3 9h4l5-4v14l-5-4H3z" />
    <path d="M16 8.5a5 5 0 0 1 0 7M19 5.5a9 9 0 0 1 0 13" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </svg>
);

export const MicIcon = ({ size = 22, ...p }: IconProps) => (
  <svg {...svg(size)} {...stroke} strokeWidth={2.2} {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

export const SendIcon = ({ size = 22, ...p }: IconProps) => (
  <svg {...svg(size)} {...stroke} strokeWidth={2.6} {...p}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

export const FlameIcon = ({ size = 16, ...p }: IconProps) => (
  <svg {...svg(size)} fill="currentColor" {...p}>
    <path d="M12 2c1.2 3.4 6 6.2 6 11.5A6 6 0 0 1 6 13.5c0-2.4 1.2-4.2 2.4-5.4.6 2.4 1.8 3.6 3 3.6 0-3.6-1.2-6.5.6-9.7z" />
  </svg>
);

export const CardsIcon = ({ size = 16, ...p }: IconProps) => (
  <svg {...svg(size)} {...stroke} strokeWidth={2.4} {...p}>
    <rect x="3" y="8" width="14" height="13" rx="2.5" />
    <path d="M7 4h11a3 3 0 0 1 3 3v10" />
  </svg>
);

export const InfoIcon = ({ size = 16, ...p }: IconProps) => (
  <svg {...svg(size)} fill="currentColor" {...p}>
    <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 8a1.2 1.2 0 0 0-1.2 1.2v5.6a1.2 1.2 0 0 0 2.4 0v-5.6A1.2 1.2 0 0 0 12 10zm0-4.2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
  </svg>
);

export const PencilIcon = ({ size = 14, ...p }: IconProps) => (
  <svg {...svg(size)} fill="currentColor" {...p}>
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
  </svg>
);

export const CheckIcon = ({ size = 16, ...p }: IconProps) => (
  <svg {...svg(size)} {...stroke} strokeWidth={3} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);

export const PersonIcon = ({ size = 20, ...p }: IconProps) => (
  <svg {...svg(size)} fill="currentColor" {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0z" />
  </svg>
);

export const HeadphonesIcon = ({ size = 14, ...p }: IconProps) => (
  <svg {...svg(size)} {...stroke} strokeWidth={2.4} {...p}>
    <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
    <rect x="3" y="14" width="5" height="7" rx="2" />
    <rect x="16" y="14" width="5" height="7" rx="2" />
  </svg>
);

export const EyeIcon = ({ size = 14, ...p }: IconProps) => (
  <svg {...svg(size)} {...stroke} strokeWidth={2.4} {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const ToneContour = ({ tone, size = 28, ...p }: IconProps & { tone: number }) => {
  const paths: Record<number, string> = {
    1: "M4 7h20",
    2: "M4 18L24 6",
    3: "M4 9c5 11 11 11 20-2",
    4: "M4 5l20 14",
    0: "M13 12.5h2",
  };
  return (
    <svg width={size} height={size * 0.86} viewBox="0 0 28 24" aria-hidden {...stroke} strokeWidth={2.6} {...p}>
      <path d={paths[tone] ?? paths[0]} />
    </svg>
  );
};
