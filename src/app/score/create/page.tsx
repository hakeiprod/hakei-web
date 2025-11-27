import { FormCreateScore } from "@/components/form-create-score";
import { prisma } from "@/prisma";
import * as Browser from "@/s-core/models/browser";

export default function Create() {
  async function handleAction(formData: FormData) {
    "use server";
    const file = formData.get("data") as File;
    const data = (await new Browser.Importer().import(file))?.export();
    if (!data) return;
    await prisma.score.create({ data: { data } });
  }
  return <FormCreateScore action={handleAction} />;
}
