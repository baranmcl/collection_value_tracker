import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { optionalEbaySearch } from '$lib/server/ebay';
import { addCollectionItem, removeCollectionItem } from './logic';

export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as { gameId: number; condition: string };
  try {
    const result = await addCollectionItem(db, body, optionalEbaySearch());
    return json(result);
  } catch (e) {
    throw error(400, e instanceof Error ? e.message : 'add failed');
  }
};

export const DELETE: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as { itemId: number };
  removeCollectionItem(db, body.itemId);
  return json({ ok: true });
};
