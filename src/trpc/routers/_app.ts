import { z } from "zod";
import { baseProcedure, createTRPCRouter } from "../init";
import { prisma } from "@/prisma";
import { ResourceFindManySchema } from "@/generated/zod/schemas";
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
  },
});
// export type definition of API
export type AppRouter = typeof appRouter;
