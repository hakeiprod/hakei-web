"use client";
import { Button, ButtonProps, Slider, SliderProps } from "@heroui/react";
import { Volume1, Volume2, VolumeX } from "lucide-react";

interface VolumeSlider {
  value: number;
  isMute: boolean;
  sliderProps: SliderProps;
  muteButtonProps: ButtonProps;
}
export function VolumeSlider(properties: VolumeSlider) {
  const numericValue = Array.isArray(properties.value)
    ? (properties.value[0] ?? 0)
    : properties.value;
  const volumeIcon = properties.isMute ? (
    <VolumeX />
  ) : numericValue < 50 ? (
    <Volume1 />
  ) : (
    <Volume2 />
  );
  return (
    <Slider
      {...properties.sliderProps}
      aria-label="Volume"
      color="foreground"
      startContent={
        <Button {...properties.muteButtonProps} isIconOnly radius="full">
          {volumeIcon}
        </Button>
      }
    />
  );
}
