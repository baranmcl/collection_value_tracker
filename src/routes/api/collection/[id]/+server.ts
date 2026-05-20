import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { applyItemUpdate } from './logic';

export const PATCH: RequestHandler = async ({ params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) throw error(400, 'bad item id');
  try {
    applyItemUpdate(db, id, await request.json());
    return json({ ok: true });
  } catch (e) {
    throw error(400, e instanceof Error ? e.message : 'update failed');
  }
};
