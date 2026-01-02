
import React from 'react';
import { 
  Sword, 
  Shield, 
  Star, 
  PlusSquare,
  History,
  Trophy,
  RotateCcw
} from 'lucide-react';

// Custom Fist Icon (King)
const FistIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M18 10V8a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
    <path d="M14 10V7a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v3" />
    <path d="M10 10V8a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
    <path d="M18 10a2 2 0 0 1 2 2v3a7 7 0 0 1-7 7H9" />
    <path d="M6 20a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2" />
  </svg>
);

// Custom Dinosaur Icon using SVG (Bishop)
const DinoIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M12 2C10 2 8 4 8 6C8 7 8 8 9 9C6 10 4 12 4 15C4 18 6 20 10 21C12 21 14 20 16 19L20 22L22 20L19 16C20 14 21 12 21 10C21 6 18 2 12 2Z" />
    <circle cx="12" cy="6" r="1" fill="currentColor" />
  </svg>
);

// Custom Hat-Plus Icon (Rook)
const HatPlusIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M4 14C4 11 6 10 12 10C18 10 20 11 20 14V16H4V14Z" />
    <path d="M12 2V6" />
    <path d="M10 4H14" />
    <path d="M8 18H16" />
  </svg>
);

export const PieceIcons: Record<string, React.FC<{ className?: string }>> = {
  pawn: Sword,
  knight: Shield,
  bishop: DinoIcon,
  rook: HatPlusIcon,
  queen: Star,
  king: FistIcon,
};

export const UI_ICONS = {
  History,
  Trophy,
  RotateCcw
};
