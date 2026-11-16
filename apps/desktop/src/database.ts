import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '@tempi/db';
import { app } from 'electron';

/** Where the app database lives: the user's data folder. */
export const appDatabasePath = (): string => path.join(app.getPath('userData'), 'tempi.db');

/** Opens (creating and migrating if needed) the app database. */
export const openAppDatabase = (): DatabaseSync => openDatabase(appDatabasePath());
