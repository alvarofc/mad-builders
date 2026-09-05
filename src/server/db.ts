import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const databaseConfigured = Boolean(import.meta.env.DATABASE_URL);

const connection = postgres(
  import.meta.env.DATABASE_URL ?? 'postgresql://invalid:invalid@127.0.0.1:1/invalid',
  {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
  },
);

export const db = drizzle(connection, { schema });
