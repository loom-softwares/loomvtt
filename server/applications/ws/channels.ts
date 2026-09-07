import { Server, Socket } from 'socket.io';
import { getPermLevel } from '../middleware/permissions.js';

/**
 * Room routing constants — Socket.IO rooms are how we target broadcasts.
 * `world:${worldId}` targets todos os clientes conectados a um mundo.
 * `stage:${stageId}` alvos apenas os clientes que viram uma stage específica.
 */
export const WORLD_ROOM_PREFIX = 'world:';
export const STAGE_ROOM_PREFIX = 'stage:';

export function worldRoom(worldId: string): string {
  return `${WORLD_ROOM_PREFIX}${worldId}`;
}

export function stageRoom(stageId: string): string {
  return `${STAGE_ROOM_PREFIX}${stageId}`;
}

/** Module-level Socket.IO server reference — set via setIo() */
let io: Server | null = null;

export function setIo(server: Server): void {
  io = server;
}

/**
 * Add a Socket.IO client to a specific world room.
 */
export function joinWorld(socket: Socket, worldId: string): void {
  socket.join(worldRoom(worldId));
}

/**
 * Remove a Socket.IO client from a specific world room.
 */
export function leaveWorld(socket: Socket, worldId: string): void {
  socket.leave(worldRoom(worldId));
}

/**
 * Add a Socket.IO client to a specific stage room.
 */
export function joinStage(socket: Socket, stageId: string): void {
  socket.join(stageRoom(stageId));
}

/**
 * Remove a Socket.IO client from a specific stage room.
 */
export function leaveStage(socket: Socket, stageId: string): void {
  socket.leave(stageRoom(stageId));
}

/**
 * Leave all world and stage rooms for a socket (called on disconnect).
 */
export function leaveAllRooms(socket: Socket): void {
  const rooms = Array.from(socket.rooms);
  for (const room of rooms) {
    if (room !== socket.id) {
      socket.leave(room);
    }
  }
}

/**
 * Leave all stage rooms for a socket (keeps world room intact).
 */
export function leaveAllStageRooms(socket: Socket): void {
  for (const room of socket.rooms) {
    if (room.startsWith(STAGE_ROOM_PREFIX)) {
      socket.leave(room);
    }
  }
}

/**
 * Broadcast a typed event to all clients in a specific world room.
 * Socket.IO emits are typed events — the `type` becomes the event name
 * on the client, and `data` is the single payload argument.
 * `excludeSocketId` removes the sender from delivery (echo prevention).
 */
export function broadcastToWorld(
  type: string,
  worldId: string,
  data: any,
  excludeSocketId?: string,
): void {
  if (!io) return;
  const room = worldRoom(worldId);
  if (excludeSocketId) {
    io.to(room).except(excludeSocketId).emit(type, data);
  } else {
    io.to(room).emit(type, data);
  }
}

/**
 * Broadcast a typed event to a world room, but only to sockets whose user
 * passes `canView(ownership, defaultPerm, userId)` — same gate the REST GET
 * routes use. Sem isto, `broadcastToWorld` manda o documento inteiro
 * (systemData incluso) pra todo jogador da sala, mesmo quem acabou de perder
 * ownership — o REST fica certo mas o push ao vivo continua vazando.
 */
export async function broadcastToWorldOwned(
  type: string,
  worldId: string,
  data: any,
  ownership: any,
  defaultPerm: number,
  excludeSocketId?: string,
  /** Quando o nivel efetivo do destinatario e 1 (Limitado), troca o payload
   *  por uma versao recortada em vez do documento inteiro. */
  redactForLimited?: (data: any) => any,
): Promise<void> {
  if (!io) return;
  const room = worldRoom(worldId);
  const sockets = await io.in(room).fetchSockets();
  for (const s of sockets) {
    if (excludeSocketId && s.id === excludeSocketId) continue;
    const auth: any = (s.data as any)?.auth || {};
    const isGmSocket = auth.admin === true || Number(auth.userRole ?? 0) >= 4;
    const level = isGmSocket ? 3 : getPermLevel(ownership, defaultPerm, auth.userId ?? null);
    if (level < 1) continue;
    s.emit(type, level === 1 && redactForLimited ? redactForLimited(data) : data);
  }
}

/**
 * Broadcast a typed event to all clients in a specific stage room.
 */
export function broadcastToStage(
  type: string,
  stageId: string,
  data: any,
  excludeSocketId?: string,
): void {
  if (!io) return;
  const room = stageRoom(stageId);
  if (excludeSocketId) {
    io.to(room).except(excludeSocketId).emit(type, data);
  } else {
    io.to(room).emit(type, data);
  }
}

/**
 * System-wide broadcast to ALL connected clients (no room scoping).
 */
export function broadcastToAllSockets(
  type: string,
  data: any,
  excludeSocketId?: string,
): void {
  if (!io) return;
  if (excludeSocketId) {
    io.except(excludeSocketId).emit(type, data);
  } else {
    io.emit(type, data);
  }
}
