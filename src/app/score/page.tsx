"use client";
import { PlayPauseButton } from "@/components/buttn-play-pause";
import { VolumeSlider } from "@/components/slider-volume";
import { Button, ButtonGroup } from "@heroui/react";
import { FastForward, Rewind, Square } from "lucide-react";

export default function Scores() {
  return (
    <>
      <ButtonGroup>
        <Button>
          <Rewind color="white" />
        </Button>
        <Button>
          <FastForward color="white" />
        </Button>
        <Button>
          <Square color="white" />
        </Button>
        <PlayPauseButton />
      </ButtonGroup>
      <VolumeSlider />
    </>
  );
}
