import { configuredWriteLease } from "../src/server/maintenance-gate";
import { PrismaClient } from "../src/generated/prisma/client";
import { defaultEvaluationRule } from "../src/s-core/models/practice/default-rule";
import { faker } from "@faker-js/faker";
const prisma = new PrismaClient();
export async function main() {
  await prisma.evaluationRuleVersion.upsert({
    where: { version: 1 },
    update: {},
    create: defaultEvaluationRule,
  });
  // Demo music is opt-in; the normal seed initializes only immutable evaluation defaults.
  if (process.argv.includes("--demo"))
    for (let index = 0; index < 20; index++) {
      await prisma.music.create({
        data: { resource: { create: { name: faker.music.album() } } },
      });
      await prisma.artist.create({
        data: { resource: { create: { name: faker.music.artist() } } },
      });
      await prisma.music.create({
        data: { resource: { create: { name: faker.music.songName() } } },
      });
    }
}
try {
  await configuredWriteLease(main);
} finally {
  await prisma.$disconnect();
}
