"use client";
import { Button, ButtonProps, Slider, SliderProps } from "@heroui/react";
import { Volume1, Volume2, VolumeX } from "lucide-react";

interface VolumeSlider {
  isMute: boolean;
  sliderProps: SliderProps;
  muteButtonProps: ButtonProps;
}
export function SliderVolume(properties: VolumeSlider) {
  const numericValue =
    (Array.isArray(properties.sliderProps.value)
      ? (properties.sliderProps.value[0] ?? 0)
      : properties.sliderProps.value) ?? 0;
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
      label={"Volume"}
      startContent={
        <Button {...properties.muteButtonProps} isIconOnly radius="full">
          {volumeIcon}
        </Button>
      }
    />
  );
}
