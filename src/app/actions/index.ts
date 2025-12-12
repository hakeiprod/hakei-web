"use server";
import { prisma } from "@/prisma";

export async function findResources(
  ...parameters: Parameters<typeof prisma.resource.findMany>
) {
  return await prisma.resource.findMany(...parameters);
}
