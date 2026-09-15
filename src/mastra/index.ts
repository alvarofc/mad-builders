import { mkdirSync } from 'node:fs';
import { Mastra } from '@mastra/core/mastra';
import { MastraEditor } from '@mastra/editor';
import { LibSQLStore } from '@mastra/libsql';
import { Observability, MastraStorageExporter, SensitiveDataFilter } from '@mastra/observability';
import { createWeeklyCoach } from '../server/weekly-coach';

mkdirSync(new URL('../../.context/', import.meta.url), { recursive: true });

export const mastra = new Mastra({
  agents: {
    weeklyCoach: createWeeklyCoach(process.env.CEREBRAS_API_KEY!, process.env.CEREBRAS_MODEL || 'qwen-3.8-27b'),
  },
  storage: new LibSQLStore({ id: 'studio-storage', url: new URL('../../.context/mastra-studio.db', import.meta.url).href }),
  editor: new MastraEditor(),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mad-builders-studio',
        exporters: [new MastraStorageExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
  server: { host: '127.0.0.1', port: 4111 },
});
