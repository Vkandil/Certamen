import Dexie, { type Table } from 'dexie';
import type { Certamen, Determinatio, ModelInfo, Responsio } from '../domain/types';

export interface SettingRow<T = unknown> {
  key: string;
  value: T;
  updatedAt: number;
}

export interface ModelsCacheRow {
  key: string;
  models: ModelInfo[];
  fetchedAt: number;
}

export class CertamenDb extends Dexie {
  certamens!: Table<Certamen, string>;
  responsiones!: Table<Responsio, string>;
  determinationes!: Table<Determinatio, string>;
  settings!: Table<SettingRow, string>;
  modelsCache!: Table<ModelsCacheRow, string>;

  constructor() {
    super('certamen');
    this.version(1).stores({
      certamens: 'id, startedAt, status, *modelIds',
      responsiones: 'id, certamenId, [certamenId+roundIndex], slot',
      determinationes: 'id, certamenId',
      settings: 'key',
      modelsCache: 'key'
    });
  }
}

export const db = new CertamenDb();

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await db.settings.get(key);
  return row?.value as T | undefined;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value, updatedAt: Date.now() });
}

export async function deleteSetting(key: string): Promise<void> {
  await db.settings.delete(key);
}

export async function markInterruptedRuns(): Promise<void> {
  const running = await db.certamens.where('status').equals('running').toArray();
  await Promise.all(running.map((certamen) => db.certamens.put({
    ...certamen,
    status: 'aborted',
    endedAt: Date.now(),
    failureReason: 'session_interrompue'
  })));
}

export async function purgeOldDrafts(): Promise<void> {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const drafts = await db.certamens.where('status').equals('draft').and((item) => item.startedAt < cutoff).toArray();
  await Promise.all(drafts.map((item) => db.certamens.delete(item.id)));
}

export async function clearAllData(): Promise<void> {
  await db.delete();
  await db.open();
}
