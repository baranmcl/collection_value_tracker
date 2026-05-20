import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { removeOneByPair } from './logic';

export const DELETE: RequestHandler = async ({ request }) => {
  try {
    removeOneByPair(db, await request.json());
    return json({ ok: true });
  } catch (e) {
    throw error(400, e instanceof Error ? e.message : 'remove failed');
  }
};
