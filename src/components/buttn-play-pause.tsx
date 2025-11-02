"use client";
import { Button } from "@heroui/button";
import { Pause, Play } from "lucide-react";
import { useState } from "react";

export function PlayPauseButton() {
  const [value, setValue] = useState(true);
  return (
    <Button onPress={() => setValue(!value)}>
      {value ? <Play color="white" /> : <Pause color="white" />}
    </Button>
  );
}
