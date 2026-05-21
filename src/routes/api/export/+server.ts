import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { exportCsv } from './logic';

export const GET: RequestHandler = () => exportCsv(db, new Date());
