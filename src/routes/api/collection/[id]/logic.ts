import type { DB } from '$lib/db/client';
import { updateItem } from '$lib/db/queries/collection';
import { parseDollars } from '$lib/money';
import { isCondition } from '$lib/types';

export interface ItemUpdateRequest {
  condition?: string;
  grade?: string | null;
  notes?: string | null;
  acquiredAt?: string | null;
  manualPriceInput?: string; // raw dollar text; '' clears the override
}

export function applyItemUpdate(db: DB, id: number, req: ItemUpdateRequest): void {
  const patch: Parameters<typeof updateItem>[2] = {};
  if (req.condition !== undefined) {
    if (!isCondition(req.condition)) throw new Error(`Invalid condition: ${req.condition}`);
    patch.condition = req.condition;
  }
  if (req.grade !== undefined) patch.grade = req.grade;
  if (req.notes !== undefined) patch.notes = req.notes;
  if (req.acquiredAt !== undefined) patch.acquiredAt = req.acquiredAt;
  if (req.manualPriceInput !== undefined) {
    const trimmed = req.manualPriceInput.trim();
    if (trimmed === '') {
      patch.manualPrice = null;
    } else {
      const cents = parseDollars(trimmed);
      if (cents === null) throw new Error(`Invalid price: ${req.manualPriceInput}`);
      patch.manualPrice = cents;
    }
  }
  updateItem(db, id, patch);
}
