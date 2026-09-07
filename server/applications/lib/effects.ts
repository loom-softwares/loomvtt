import { BuffsDocument } from '../schemas/buffs.schema.js';

export interface BuffChange {
  key: string;
  mode: 'add' | 'multiply' | 'override' | 'upgrade' | 'downgrade';
  value: number | string | boolean;
  /** Ordem de aplicacao (crescente, default 0). Importa quando dois efeitos
   *  mexem no mesmo campo — sem isso, quem ganha depende da ordem do banco. */
  priority?: number;
}

function getPath(obj: any, path: string[]): any {
  return path.reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setPath(obj: any, path: string[], value: any): void {
  const last = path[path.length - 1];
  const parent = path.slice(0, -1).reduce((o, k) => {
    if (typeof o[k] !== 'object' || o[k] === null) o[k] = {};
    return o[k];
  }, obj);
  parent[last] = value;
}

/** Aplica os `changes` dos buffs ativos (não desabilitados) em cima de uma cópia de systemData. Não persiste nada — é só leitura/derivação, igual actor.prepareData(). */
export function applyBuffChanges(systemData: Record<string, any>, buffs: Array<{ disabled?: boolean; changes?: BuffChange[] }>): Record<string, any> {
  const result = JSON.parse(JSON.stringify(systemData ?? {}));

  // Achata os changes de TODOS os buffs ativos numa lista so e ordena por
  // priority antes de aplicar — sem isso, quando dois efeitos mexem no mesmo
  // campo, quem ganha depende da ordem que o banco devolveu. `sort` e' estavel
  // em JS moderno, entao changes sem priority (todos os dados existentes,
  // que caem no default 0) mantem exatamente a ordem de hoje.
  const allChanges: BuffChange[] = [];
  for (const buff of buffs) {
    if (buff.disabled) continue;
    for (const change of buff.changes ?? []) {
      if (!change?.key) continue;
      allChanges.push(change);
    }
  }
  allChanges.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

  for (const change of allChanges) {
    const path = change.key.split('.');
    const current = getPath(result, path);

    if (change.mode === 'override') {
      setPath(result, path, change.value);
    } else if (change.mode === 'add') {
      const base = typeof current === 'number' ? current : 0;
      setPath(result, path, base + Number(change.value));
    } else if (change.mode === 'multiply') {
      const base = typeof current === 'number' ? current : 0;
      setPath(result, path, base * Number(change.value));
    } else if (change.mode === 'upgrade') {
      // So aplica se for MAIOR que o atual ("no minimo X").
      const base = typeof current === 'number' ? current : 0;
      const next = Number(change.value);
      if (next > base) setPath(result, path, next);
    } else if (change.mode === 'downgrade') {
      // So aplica se for MENOR que o atual ("no maximo X").
      const base = typeof current === 'number' ? current : 0;
      const next = Number(change.value);
      if (next < base) setPath(result, path, next);
    }
  }

  return result;
}

/** Busca os buffs ativos do actor e devolve uma cópia de systemData com os `changes` aplicados. */
export async function withActiveEffects(actorId: string, systemData: Record<string, any>): Promise<Record<string, any>> {
  const buffs = await BuffsDocument.find<{ disabled?: boolean; changes?: BuffChange[] }>({ actorId, disabled: false });
  if (!buffs.length) return systemData;
  return applyBuffChanges(systemData, buffs);
}
