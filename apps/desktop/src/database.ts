import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '@tempi/db';
import { app } from 'electron';

/** Opens (creating and migrating if needed) the app database in the user's data folder. */
export const openAppDatabase = (): DatabaseSync => openDatabase(path.join(app.getPath('userData'), 'tempi.db'));
