import { FormCreateScore } from "@/components/form-create-score";
import { prisma } from "@/prisma";
import * as Browser from "@/s-core/models/browser";
import { redirect } from "next/navigation";

async function handleAction(formData: FormData) {
  "use server";
  const sheet = await new Browser.Importer().import(
    formData.get("data") as File
  );
  if (!sheet) return;
  const score = await prisma.score.create({
    data: { data: sheet.export() as object },
  });
  redirect(`/score/${score.id}`);
}

export default function Create() {
  return <FormCreateScore action={handleAction} />;
}

export const config = {
  api: {
    bodyParser: { sizeLimit: "100mb" },
  },
};
