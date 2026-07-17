import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Prisma CLI operations use the direct PostgreSQL endpoint. Runtime uses DATABASE_URL.
    url: env('DIRECT_URL'),
  },
});
