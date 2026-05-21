import type { RequestHandler } from './$types';
import { sqlite } from '$lib/db/client';
import { backupDatabase } from './logic';

export const GET: RequestHandler = () => backupDatabase(sqlite, new Date());
