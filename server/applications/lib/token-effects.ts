export interface TokenEffectDef {
  id: string;
  name: string;
  icon: string;
  color: number;
  type: 'glow' | 'aura' | 'pulse' | 'tint' | 'fade';
}

export const TOKEN_EFFECTS: Record<string, TokenEffectDef> = {
  'glow-fire': { id: 'glow-fire', name: 'Fire Glow', icon: '🔥', color: 0xf97316, type: 'glow' },
  'glow-holy': { id: 'glow-holy', name: 'Holy Glow', icon: '✨', color: 0xfbbf24, type: 'glow' },
  'glow-shadow': { id: 'glow-shadow', name: 'Shadow', icon: '🌑', color: 0x6b21a8, type: 'glow' },
  'glow-arcane': { id: 'glow-arcane', name: 'Arcane', icon: '🔮', color: 0x6366f1, type: 'glow' },
  'glow-poison': { id: 'glow-poison', name: 'Poison', icon: '☠️', color: 0x10b981, type: 'glow' },
  'aura-protection': { id: 'aura-protection', name: 'Protection', icon: '🛡️', color: 0x3b82f6, type: 'aura' },
  'aura-darkness': { id: 'aura-darkness', name: 'Darkness', icon: '🌑', color: 0x1e293b, type: 'aura' },
  'pulse': { id: 'pulse', name: 'Pulse', icon: '💓', color: 0xef4444, type: 'pulse' },
  'berserk': { id: 'berserk', name: 'Berserk', icon: '⚔️', color: 0xef4444, type: 'tint' },
  'frost': { id: 'frost', name: 'Frost', icon: '❄️', color: 0x93c5fd, type: 'tint' },
  'invisible': { id: 'invisible', name: 'Invisible', icon: '👻', color: 0x94a3b8, type: 'fade' },
};

export const STATUS_LABELS: Record<string, string> = {
  bleeding: 'Bleeding',
  poisoned: 'Poisoned',
  concentrated: 'Concentrated',
  stunned: 'Stunned',
  prone: 'Prone',
  invisible: 'Invisible',
  burning: 'Burning',
};

export const STATUS_COLORS: Record<string, number> = {
  bleeding: 0xef4444,
  poisoned: 0x10b981,
  concentrated: 0x3b82f6,
  stunned: 0xf59e0b,
  prone: 0x94a3b8,
  invisible: 0x6366f1,
  burning: 0xf97316,
};
