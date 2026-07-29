"use client";

import { Button } from "@heroui/button";
import { useParams } from "next/navigation";

export default function ScoreEdit({
  onDelete,
}: {
  onDelete: (id: number) => void;
}) {
  const parameters_ = useParams();

  return (
    <Button onPress={() => onDelete(Number(parameters_.id))}>delete</Button>
  );
}
