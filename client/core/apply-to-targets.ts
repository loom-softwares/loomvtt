/*******************************************************************************
 * LoomVTT
 * client/core/apply-to-targets.ts
 * 
 * 
 * Utility for applying roll results to targeted tokens.
 ******************************************************************************/

import { api } from './api.js';

interface TargetData {
  castId: string;
  actorId?: string;
  isLinked?: boolean;
  systemData?: Record<string, any>;
}

/**
 * Apply a roll result to targeted tokens.
 * For linked tokens, updates the base actor's data.
 * For unlinked tokens, updates the cast member's data.
 * Application is triggered by GM/owner clicking "Aplicar" on a roll card.
 */
export async function applyToTargets(
  rollTotal: number,
  applyTo: string,
  targetIds: string[],
  worldId: string,
): Promise<void> {
  if (targetIds.length === 0) return;

  const applyPath = applyTo; // e.g. "hp", "resources.0.value", "wounds"

  for (const castId of targetIds) {
    try {
      const castMember = await api.get<any>(`/cast/${castId}`);
      if (!castMember) continue;

      const isLinked = castMember.isLinked === true;
      const currentVal = getNestedValue(
        isLinked ? castMember.systemData : castMember.systemData,
        applyPath,
      );
      const newVal = Math.max(0, (currentVal || 0) - rollTotal);

      const patch: Record<string, any> = {};
      setNestedValue(patch, `systemData.${applyPath}`, newVal);

      if (isLinked && castMember.actorId) {
        // Update base actor
        const actor = await api.get<any>(`/actors/${castMember.actorId}`);
        if (actor) {
          const actorPatch: Record<string, any> = {};
          setNestedValue(actorPatch, `systemData.${applyPath}`, newVal);
          await api.put(`/actors/${castMember.actorId}`, actorPatch);
        }
      } else {
        // Update cast member directly
        await api.put(`/cast/${castId}`, patch);
      }
    } catch (e) {
      console.error(`[applyToTargets] Failed to apply to cast ${castId}:`, e);
    }
  }
}

function getNestedValue(obj: any, path: string): any {
  const parts = path.split('.');
  let val = obj;
  for (const part of parts) {
    if (val == null || typeof val !== 'object') return undefined;
    val = val[part];
  }
  return val;
}

function setNestedValue(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length; i++) {
    if (i === parts.length - 1) {
      current[parts[i]] = value;
    } else {
      current[parts[i]] = current[parts[i]] || {};
      current = current[parts[i]];
    }
  }
}