/**
 * client/src/lib/chat-commands.ts
 * LoomVTT Chat Command Parser — original implementation.
 *
 * Commands:
 *   /r  /roll        — public roll
 *   /gr /gmroll      — roll visible only to GM + roller
 *   /br /blindroll   — GM rolls, player sees no result
 *   /sr /selfroll    — only roller sees result
 *   /w  /whisper     — private message to user(s)
 *   /ooc             — out-of-character bubble
 *   /ic              — in-character (as active actor)
 *   /me  /emote      — emote action
 *   /help            — show command list
 */

export type ChatStyle = 0 | 1 | 2 | 3;
export const CHAT_STYLE = {
  OTHER:  0 as ChatStyle,   // generic / system
  OOC:    1 as ChatStyle,   // out-of-character (player color outline)
  IC:     2 as ChatStyle,   // in-character (spoken as active actor)
  EMOTE:  3 as ChatStyle,   // action emote
} as const;

export type RollMode = 'public' | 'gmroll' | 'blindroll' | 'selfroll';

export type ParsedCommand =
  | { kind: 'roll';    formula: string; mode: RollMode; flavor?: string }
  | { kind: 'whisper'; targets: string[]; content: string }
  | { kind: 'chat';    content: string; style: ChatStyle }
  | { kind: 'help' }
  | { kind: 'unknown'; raw: string };

/**
 * Parse a raw chat input string into a structured command.
 * Input that doesn't start with "/" is treated as a public chat message.
 */
export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();

  if (!trimmed.startsWith('/')) {
    return { kind: 'chat', content: trimmed, style: CHAT_STYLE.OOC };
  }

  // Split into /command and the rest
  const spaceIdx = trimmed.indexOf(' ');
  const cmd = (spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx)).toLowerCase();
  const rest = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();

  switch (cmd) {
    // ── Roll variants ────────────────────────────────────────────────────────
    case 'r':
    case 'roll':
      return { kind: 'roll', formula: rest || '1d20', mode: 'public' };

    case 'gr':
    case 'gmroll':
      return { kind: 'roll', formula: rest || '1d20', mode: 'gmroll' };

    case 'br':
    case 'blindroll':
      return { kind: 'roll', formula: rest || '1d20', mode: 'blindroll' };

    case 'sr':
    case 'selfroll':
      return { kind: 'roll', formula: rest || '1d20', mode: 'selfroll' };

    // ── Whisper ──────────────────────────────────────────────────────────────
    case 'w':
    case 'whisper': {
      // /w TargetName message  or  /w [Target One, Target Two] message
      const bracketMatch = rest.match(/^\[([^\]]+)\]\s*(.*)/s);
      if (bracketMatch) {
        const targets = bracketMatch[1].split(',').map(t => t.trim());
        return { kind: 'whisper', targets, content: bracketMatch[2] };
      }
      const firstSpace = rest.indexOf(' ');
      if (firstSpace === -1) return { kind: 'whisper', targets: [rest], content: '' };
      return {
        kind: 'whisper',
        targets: [rest.slice(0, firstSpace)],
        content: rest.slice(firstSpace + 1),
      };
    }

    // ── Chat styles ───────────────────────────────────────────────────────────
    case 'ooc':
      return { kind: 'chat', content: rest, style: CHAT_STYLE.OOC };

    case 'ic':
      return { kind: 'chat', content: rest, style: CHAT_STYLE.IC };

    case 'me':
    case 'emote':
      return { kind: 'chat', content: rest, style: CHAT_STYLE.EMOTE };

    // ── Help ──────────────────────────────────────────────────────────────────
    case 'help':
      return { kind: 'help' };

    default:
      return { kind: 'unknown', raw: trimmed };
  }
}

/** Human-readable command reference shown by /help */
export const COMMAND_HELP = [
  { cmd: '/roll <formula>',      alias: '/r',  desc: 'Roll dice publicly', mode: 'public' },
  { cmd: '/gmroll <formula>',    alias: '/gr', desc: 'Roll — only GM sees result', mode: 'gmroll' },
  { cmd: '/blindroll <formula>', alias: '/br', desc: 'GM rolls for you, you see nothing', mode: 'blindroll' },
  { cmd: '/selfroll <formula>',  alias: '/sr', desc: 'Roll — only you see result', mode: 'selfroll' },
  { cmd: '/w <name> <message>',  alias: '/whisper', desc: 'Private message to a player' },
  { cmd: '/ooc <message>',       alias: null,  desc: 'Out-of-character message' },
  { cmd: '/ic <message>',        alias: null,  desc: 'In-character (as your actor)' },
  { cmd: '/me <action>',         alias: '/emote', desc: 'Emote action' },
] as const;

/** Roll mode label shown in the UI */
export const ROLL_MODE_LABEL: Record<RollMode, string> = {
  public:    '🌐 Public Roll',
  gmroll:    '🎲 GM Roll',
  blindroll: '🙈 Blind Roll',
  selfroll:  '🔒 Self Roll',
};
