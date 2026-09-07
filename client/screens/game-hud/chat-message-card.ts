import { createWrappable } from '../../core/wrappable.js';
import { renderRollCardWrap } from './roll-card.js';
import { t } from '../../lib/i18n.js';
import type { RollResult } from './roll-card.js';
import { dispatchRoll } from './roll-dispatch.js';
import { gameContext } from '../../core/game-context.js';
import { actorsCollection } from '../../core/actors-collection.js';
import { DEFAULT_PORTRAIT_URL } from '../../lib/default-portrait.js';

type RollMode = 'public' | 'gmroll' | 'blindroll' | 'selfroll';

interface Speaker {
  actorId?: string;
  actorName?: string;
  actorAvatar?: string;
}

interface ChatMessageForCard {
  id?: string;
  userName: string;
  userColor: string;
  userAvatar?: string;
  content: string;
  timestamp: Date;
  isRoll?: boolean;
  roll?: RollResult;
  rollMode?: RollMode;
  speaker?: Speaker;
  flags?: Record<string, Record<string, any>>;
}

export interface ChatCardContextOption {
  icon?: string;
  label: string;
  action: () => void;
  danger?: boolean;
}

/** Generic reroll — ALWAYS available on any roll message, even
 * without any system registering anything (explicit request: it must work
 * independently of any card customization). Resends the SAME
 * formula/mode/meta/actorId of the original roll via dispatchRoll — it is a
 * truly new roll, does not edit the old one. The system can stack on top
 * via `Loom.wraps.chatCardContextOptions.addWrapper((wrapped, msg) => [...wrapped(msg), {...}])`
 * to add its own criteria (e.g. Rage reroll in wod6e), without needing to
 * rewrite the card or reimplement the basic reroll. */
function chatCardContextOptions(msg: ChatMessageForCard): ChatCardContextOption[] {
  if (!msg.isRoll || !msg.roll) return [];
  const roll = msg.roll;
  return [{
    icon: '<i class="fa-solid fa-rotate-right"></i>',
    label: t('sidebar.reroll'),
    action: () => {
      const worldId = gameContext.worldId || '';
      if (!worldId) return;
      dispatchRoll({
        worldId,
        userId: gameContext.session?.userId || '',
        userName: msg.userName,
        userColor: msg.userColor,
        formula: roll.formula,
        mode: roll.mode,
        actorId: msg.speaker?.actorId,
        // isReroll/rerollOf mark the new roll as a consequence of another —
        // the system reads this in `Loom.wraps.renderRollCard`/`preRoll` to, for
        // example, show "(reroll)" on the card or apply a penalty on chained
        // rerolls. rerollCount increments on each successive reroll.
        meta: { ...roll.meta, isReroll: true, rerollOf: msg.id, rerollCount: (roll.meta?.rerollCount || 0) + 1 },
      });
    },
  }];
}

export const chatCardContextOptionsWrap = createWrappable(chatCardContextOptions);

/** Lightweight markup for chat text — runs AFTER `esc()`, so it only produces
 * the fixed tags below on top of already escaped text (no risk of user
 * injected HTML). Intentionally lacks a full markdown parser —
 * covers bold, code block, image (formatting toolbar) and Font Awesome
 * icon (used by server-generated messages, e.g. roll tables). The
 * icon class only accepts letters/numbers/hyphens/spaces — even running
 * after esc(), it's impossible to close the tag and inject an attribute. */
function formatChatContent(escaped: string): string {
  let out = escaped.replace(/```\n?([\s\S]*?)\n?```/g, '<pre class="sidebar-message-code"><code>$1</code></pre>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/!\[img\]\(([^)]+)\)/g, '<img src="$1" class="sidebar-message-img" />');
  out = out.replace(/\[icon:([a-z0-9\- ]+)\]/gi, '<i class="$1"></i>');
  return out;
}

function renderMessage(msg: ChatMessageForCard, ctx: { esc: (s: string) => string; canSeeRoll: boolean; canDelete?: boolean }): string {
  const { esc, canSeeRoll, canDelete } = ctx;
  const formatTime = (date: Date): string => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // `speaker` arrives in two different forms depending on who assembled the message:
  // `{actorId, actorName, actorAvatar}` (rolls, already resolved on the server) or
  // `{actor, token, alias}` (`Loom.ChatMessage.getSpeaker()`, used by simple
  // system messages like `_onFormToChat`). Without normalizing both, messages of
  // the second type fell back to the logged-in user's name/avatar (`msg.userName`) instead
  // of the Actor who actually spoke.
  const sp = msg.speaker as any;
  const speakerActorId: string | undefined = sp?.actorId || sp?.actor || undefined;
  const liveSpeakerActor = speakerActorId ? actorsCollection.get(speakerActorId) : undefined;
  const resolvedActorName: string | undefined = sp?.actorName || sp?.alias || liveSpeakerActor?.name;
  const resolvedActorAvatar: string | undefined = sp?.actorAvatar || liveSpeakerActor?.avatarUrl;
  const hasSpeaker = !!resolvedActorName;

  const displayAvatar = hasSpeaker ? resolvedActorAvatar : msg.userAvatar;
  const displayName = hasSpeaker ? resolvedActorName! : msg.userName;
  const isOOC = !hasSpeaker;

  // Same fallback used in the Actors list/players-list/world-login: without their own
  // portrait, it shows the default portrait (image), not a generic icon — inconsistent
  // to see the same Actor with a portrait in the sidebar and without a portrait in the chat card.
  const avatarHtml = `<img class="chat-avatar-img" src="${esc(displayAvatar || DEFAULT_PORTRAIT_URL)}" alt="${esc(displayName)}" />`;

  const speakerBlock = `
    <div class="chat-speaker-block">
      <div class="chat-avatar">${avatarHtml}</div>
      <div class="chat-speaker-info">
        <div class="chat-speaker-name" ${!hasSpeaker ? `style="color: ${esc(msg.userColor)};"` : ''}>
          ${esc(displayName)}
          ${hasSpeaker ? `<span class="chat-speaker-player-tag" style="color: ${esc(msg.userColor)};">${esc(msg.userName)}</span>` : ''}
        </div>
        <div class="chat-message-ts">${formatTime(msg.timestamp)}</div>
      </div>
      ${canDelete ? `<button type="button" class="chat-message-delete" data-action="delete-message" data-id="${esc(msg.id || '')}" title="${esc(t('sidebar.deleteMessage'))}"><i class="fa-solid fa-trash"></i></button>` : ''}
    </div>`;

  // "Info" card (name + icon + description, no roll at all) — used
  // by converted systems to announce things like resource damage, item
  // shown in chat, etc. Original Foundry only had this because the generic
  // ChatMessage template always read `flags.<system>.{name,img,description}`;
  // here nobody drew this card, so every message of this type appeared
  // empty — only the header, with nothing inside.
  const infoFlags = msg.flags
    ? Object.values(msg.flags).find((f) => f && typeof f === 'object' && typeof f.name === 'string')
    : undefined;

  let bodyHtml = '';
  if (msg.isRoll && msg.roll) {
    if (!canSeeRoll) {
      const mode = msg.roll?.mode || msg.rollMode || 'public';
      const modeLabel: Record<string, string> = { gmroll: t('sidebar.rollHidden'), blindroll: t('sidebar.rollGmHidden'), selfroll: t('sidebar.rollPrivate') };
      bodyHtml = `<div class="sidebar-message-text sidebar-message-whisper"><i class="fa-solid fa-dice-d20"></i> ${modeLabel[mode] || 'roll'}</div>`;
    } else {
      bodyHtml = renderRollCardWrap(msg.roll, esc);
    }
  } else if (infoFlags) {
    bodyHtml = `<div class="sidebar-message-info">
      <div class="sidebar-message-info-header">
        ${infoFlags.img ? `<img class="sidebar-message-info-icon" src="${esc(infoFlags.img)}" alt="" />` : ''}
        <span class="sidebar-message-info-name">${esc(infoFlags.name)}</span>
      </div>
      ${infoFlags.description ? `<div class="sidebar-message-info-desc">${infoFlags.description}</div>` : ''}
    </div>`;
  } else {
    bodyHtml = `<div class="sidebar-message-text">${formatChatContent(esc(msg.content))}</div>`;
  }

  const extraClasses = [];
  if (hasSpeaker) extraClasses.push('sidebar-message-ic');
  else extraClasses.push('sidebar-message-ooc');
  if (msg.isRoll) extraClasses.push('sidebar-message-roll');

  return `<div class="sidebar-message ${extraClasses.join(' ')}" data-message-id="${esc(msg.id || '')}">
    ${speakerBlock}
    <div class="sidebar-message-body">
      ${bodyHtml}
    </div>
  </div>`;
}

export const renderMessageWrap = createWrappable(renderMessage);
