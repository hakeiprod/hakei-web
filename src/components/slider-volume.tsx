"use client";
import { Button, ButtonProps, Slider, SliderProps } from "@heroui/react";
import { Volume1, Volume2, VolumeX } from "lucide-react";

interface VolumeSlider {
  value: number;
  isMute: boolean;
  sliderProps: SliderProps;
  muteButtonProps: ButtonProps;
}
export function VolumeSlider(props: VolumeSlider) {
  const numericValue = Array.isArray(props.value)
    ? (props.value[0] ?? 0)
    : props.value;
  const volumeIcon = props.isMute ? (
    <VolumeX />
  ) : numericValue < 50 ? (
    <Volume1 />
  ) : (
    <Volume2 />
  );
  return (
    <Slider
      {...props.sliderProps}
      aria-label="Volume"
      color="foreground"
      startContent={
        <Button {...props.muteButtonProps} isIconOnly radius="full">
          {volumeIcon}
        </Button>
      }
    />
  );
}
