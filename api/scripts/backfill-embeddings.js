/**
 * Embed every row still missing its vector, across all embedded tables.
 * Idempotent — only NULL embeddings are touched.
 *
 *   docker exec ffg-api node scripts/backfill-embeddings.js
 */
import { reindexAll, embedReady } from '../src/embed.js';

if (!embedReady) {
  console.error('OPENAI_API_KEY is not set — nothing to do');
  process.exit(1);
}

const result = await reindexAll();
console.log(JSON.stringify(result, null, 2));
process.exit(0);
