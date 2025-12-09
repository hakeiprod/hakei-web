"use client";
import { Button, ButtonProps } from "@heroui/button";
import { Pause, Play } from "lucide-react";

interface ButtonPlayProperties extends Omit<ButtonProps, "value" | "onPress"> {
  isPlaying: boolean;
  onPress: (value: boolean) => void;
}
export function ButtonPlayPause(properties: ButtonPlayProperties) {
  function handlePress() {
    properties.onPress(properties.isPlaying);
  }
  return (
    <Button onPress={handlePress}>
      {properties.isPlaying ? <Pause color="white" /> : <Play color="white" />}
    </Button>
  );
}
