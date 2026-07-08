import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const datasourceUrl = process.env.PGX_CONN_STR?.trim();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  ...(datasourceUrl
    ? {
        datasource: {
          url: datasourceUrl,
        },
      }
    : {}),
});
