"use client";
import { Button, ButtonProps } from "@heroui/button";
import { Pause, Play } from "lucide-react";
import { useState } from "react";

interface ButtonPlayProps extends Omit<ButtonProps, "value" | "onPress"> {
  isPlaying: boolean;
  onPress: (value: boolean) => void;
}
export function ButtonPlayPause(props: ButtonPlayProps) {
  function handlePress() {
    props.onPress(props.isPlaying);
  }
  return (
    <Button onPress={handlePress}>
      {props.isPlaying ? <Pause color="white" /> : <Play color="white" />}
    </Button>
  );
}
