-- DropEnum
DROP TYPE "public"."ResourceUnionType";

-- DropEnum
DROP TYPE "public"."SearchableType";

-- CreateTable
CREATE TABLE "Score" (
    "id" SERIAL NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);
