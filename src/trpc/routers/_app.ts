import { z } from "zod";
import { baseProcedure, createTRPCRouter } from "../init";
import { prisma } from "@/prisma";
import {
  ResourceFindManySchema,
  ResourceIncludeObjectSchema,
  ResourceWhereInputObjectSchema,
} from "@/generated/zod/schemas";
export const appRouter = createTRPCRouter({
  hello: baseProcedure
    .input(
      z.object({
        text: z.string(),
      })
    )
    .query((options) => {
      return {
        greeting: `hello ${options.input.text}`,
      };
    }),
  resource: {
    findMany: baseProcedure
      .input(ResourceFindManySchema)
      .query((options) => prisma.resource.findMany(options.input)),
    infinity: baseProcedure
      .input(
        z.object({
          where: ResourceWhereInputObjectSchema,
          include: ResourceIncludeObjectSchema,
          limit: z.number().min(1).max(100).nullish(),
          cursor: z.number().nullish(), // <-- "cursor" needs to exist, but can be any type
          direction: z.enum(["forward", "backward"]), // optional, useful for bi-directional query
        })
      )
      .query(async (options) => {
        const { input } = options;
        const limit = input.limit ?? 50;
        const { cursor } = input;
        const items = await prisma.resource.findMany({
          where: input.where,
          include: input.include,
          take: limit + 1, // get an extra item at the end which we'll use as next cursor
          // where: {
          //   name: {
          //     contains: "Prisma" /* Optional filter */,
          //   },
          // },
          cursor: cursor ? { id: cursor } : undefined,
          orderBy: {
            id: "asc",
          },
        });
        let nextCursor: typeof cursor | undefined = undefined;
        if (items.length > limit) {
          const nextItem = items.pop();
          nextCursor = nextItem!.id;
        }
        return {
          items,
          nextCursor,
        };
      }),
  },
});
// export type definition of API
export type AppRouter = typeof appRouter;
