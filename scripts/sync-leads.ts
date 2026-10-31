import { PrismaClient } from "@prisma/client";
import { syncLeads } from "../src/leads/sync";

if (!process.env.DATABASE_URL) {
  try { process.loadEnvFile(".env"); } catch { /* CI sets env directly. */ }
}

const prisma = new PrismaClient();
syncLeads(prisma, (m) => console.log(m))
  .then((r) => console.log(`Done: ${r.fetched} posts checked, ${r.kept} worth contacting, ${r.added} new.`))
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
