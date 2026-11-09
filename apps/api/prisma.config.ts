import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '../.env') });

const dbUrl = process.env.DATABASE_URL || 'postgresql://app_transmissao:devpass@localhost:5432/transmissao?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: dbUrl },
});
