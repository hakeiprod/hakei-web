import { map, pipe, times } from "remeda";
import { PrismaClient } from "../src/generated/prisma/client";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

export async function main() {
  times(20, async () => {
    await prisma.music.create({
      data: { resource: { create: { name: faker.music.album() } } },
      include: { resource: true },
    });
    await prisma.artist.create({
      data: { resource: { create: { name: faker.music.artist() } } },
      include: { resource: true },
    });
    await prisma.music.create({
      data: { resource: { create: { name: faker.music.songName() } } },
      include: { resource: true },
    });
  });
}

main();
