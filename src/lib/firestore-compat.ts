/**
 * Firestore-compatible API implemented on top of Supabase (Postgres).
 *
 * This module is aliased to `firebase/firestore` in vite.config.ts, so the rest
 * of the application keeps importing { collection, doc, onSnapshot, setDoc, ... }
 * exactly as before — no component code had to change.
 *
 * Data model: every Firestore "collection" maps to a Postgres table with the
 * shape (id text primary key, data jsonb, updated_at timestamptz). The full
 * document object is stored in `data`, so the schemaless Firestore behaviour is
 * preserved faithfully.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

// ----- Reference types -------------------------------------------------------

interface DbHandle { client: SupabaseClient; }

export interface CollectionRef {
  __kind: 'collection';
  client: SupabaseClient;
  table: string;
}

export interface DocRef {
  __kind: 'doc';
  client: SupabaseClient;
  table: string;
  id: string;
}

type Constraint =
  | { type: 'where'; field: string; op: string; value: any }
  | { type: 'orderBy'; field: string; dir: 'asc' | 'desc' }
  | { type: 'limit'; n: number };

export interface QueryRef {
  __kind: 'query';
  client: SupabaseClient;
  table: string;
  constraints: Constraint[];
}

function genId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

function getClient(h?: DbHandle): SupabaseClient {
  return h && h.client ? h.client : supabase;
}

// ----- Builders --------------------------------------------------------------

export function collection(db: DbHandle, table: string): CollectionRef {
  return { __kind: 'collection', client: getClient(db), table };
}

// doc(db, table, id?)  OR  doc(collectionRef, id?)
export function doc(parent: DbHandle | CollectionRef, a?: string, b?: string): DocRef {
  if (parent && (parent as CollectionRef).__kind === 'collection') {
    const col = parent as CollectionRef;
    return { __kind: 'doc', client: col.client, table: col.table, id: a ?? genId() };
  }
  const db = parent as DbHandle;
  const table = a as string;
  return { __kind: 'doc', client: getClient(db), table, id: b ?? genId() };
}

export function where(field: string, op: string, value: any): Constraint {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): Constraint {
  return { type: 'orderBy', field, dir };
}

export function limit(n: number): Constraint {
  return { type: 'limit', n };
}

export function query(ref: CollectionRef | QueryRef, ...constraints: Constraint[]): QueryRef {
  const base: QueryRef =
    ref.__kind === 'query'
      ? { ...ref, constraints: [...ref.constraints] }
      : { __kind: 'query', client: ref.client, table: ref.table, constraints: [] };
  base.constraints.push(...constraints.filter(Boolean));
  return base;
}

// ----- Snapshots -------------------------------------------------------------

function makeDocSnap(ref: DocRef, row: any | null) {
  return {
    id: ref.id,
    ref,
    exists: () => row != null,
    data: () => (row ? row.data : undefined),
  };
}

function makeQuerySnap(ref: { client: SupabaseClient; table: string }, rows: any[]) {
  const docs = rows.map((row) => {
    const dref: DocRef = { __kind: 'doc', client: ref.client, table: ref.table, id: row.id };
    return {
      id: row.id,
      ref: dref,
      exists: () => true,
      data: () => row.data,
    };
  });
  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (fn: (d: any) => void) => docs.forEach(fn),
  };
}

// ----- Query execution -------------------------------------------------------

async function runQuery(q: QueryRef | CollectionRef): Promise<any[]> {
  const table = q.table;
  const client = q.client;
  const constraints: Constraint[] = q.__kind === 'query' ? q.constraints : [];

  let builder: any = client.from(table).select('id,data');

  const orderBys: Constraint[] = [];
  let limitN: number | null = null;

  for (const c of constraints) {
    if (c.type === 'where') {
      // Only equality is used by the app; map to a jsonb text comparison.
      const col = `data->>${c.field}`;
      builder = builder.eq(col, c.value as any);
    } else if (c.type === 'orderBy') {
      orderBys.push(c);
    } else if (c.type === 'limit') {
      limitN = c.n;
    }
  }

  for (const o of orderBys) {
    builder = builder.order(`data->>${(o as any).field}`, { ascending: (o as any).dir !== 'desc' });
  }
  if (limitN != null) builder = builder.limit(limitN);

  const { data, error } = await builder;
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return data || [];
}

// ----- Reads -----------------------------------------------------------------

export async function getDoc(ref: DocRef) {
  const { data, error } = await ref.client
    .from(ref.table)
    .select('id,data')
    .eq('id', ref.id)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') {
    throw Object.assign(new Error(error.message), { code: error.code });
  }
  return makeDocSnap(ref, data || null);
}

// Firestore's "force a server read"; identical here.
export const getDocFromServer = getDoc;

export async function getDocs(ref: QueryRef | CollectionRef) {
  const rows = await runQuery(ref);
  return makeQuerySnap(ref, rows);
}

// ----- Writes ----------------------------------------------------------------

export async function setDoc(ref: DocRef, value: any, options?: { merge?: boolean }) {
  let payload = value;
  if (options && options.merge) {
    const existing = await getDoc(ref);
    payload = { ...(existing.exists() ? existing.data() : {}), ...value };
  }
  const { error } = await ref.client
    .from(ref.table)
    .upsert({ id: ref.id, data: payload, updated_at: new Date().toISOString() });
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
}

export async function updateDoc(ref: DocRef, value: any) {
  const existing = await getDoc(ref);
  const merged = { ...(existing.exists() ? existing.data() : {}), ...value };
  const { error } = await ref.client
    .from(ref.table)
    .upsert({ id: ref.id, data: merged, updated_at: new Date().toISOString() });
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
}

export async function deleteDoc(ref: DocRef) {
  const { error } = await ref.client.from(ref.table).delete().eq('id', ref.id);
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
}

// ----- Realtime (onSnapshot) -------------------------------------------------

let channelSeq = 0;

type NextFn = (snap: any) => void;
type ErrFn = (err: any) => void;

export function onSnapshot(
  target: DocRef | CollectionRef | QueryRef,
  onNext: NextFn,
  onError?: ErrFn,
): () => void {
  const client = (target as any).client as SupabaseClient;
  const table = (target as any).table as string;
  const isDoc = (target as any).__kind === 'doc';
  let active = true;

  const emit = async () => {
    if (!active) return;
    try {
      if (isDoc) {
        const snap = await getDoc(target as DocRef);
        if (active) onNext(snap);
      } else {
        const rows = await runQuery(target as QueryRef | CollectionRef);
        if (active) onNext(makeQuerySnap(target as any, rows));
      }
    } catch (err) {
      if (active && onError) onError(err);
    }
  };

  // Initial load (Firestore fires immediately with current data).
  emit();

  // Subscribe to any change on the table and re-run the query/read.
  const channel = client
    .channel(`rt_${table}_${++channelSeq}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      () => { emit(); },
    )
    .subscribe();

  return () => {
    active = false;
    try { client.removeChannel(channel); } catch { /* noop */ }
  };
}

// Convenience no-ops kept for API symmetry (unused by the app).
export function getFirestore() { return { client: supabase }; }
