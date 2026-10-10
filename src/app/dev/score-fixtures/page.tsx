import { notFound, redirect } from "next/navigation";

export default function ScoreFixturesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  redirect("/dev/core/fixtures");
}
