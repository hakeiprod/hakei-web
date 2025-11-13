"use server";
import { prisma } from "@/prisma";

export async function findResources(
  ...params: Parameters<typeof prisma.resource.findMany>
) {
  return await prisma.resource.findMany(...params);
}
