import { useState } from "react";
import { Button, Slider, SliderValue } from "@heroui/react";
import { Volume1, Volume2, VolumeX } from "lucide-react";

export function VolumeSlider() {
  const [value, setValue] = useState<SliderValue>(100);
  const [previousValue, setPreviousValue] = useState<SliderValue>(value);
  const [mute, setMute] = useState(false);
  const numericValue = Array.isArray(value) ? (value[0] ?? 0) : value;
  const volumeIcon = mute ? (
    <VolumeX />
  ) : numericValue < 50 ? (
    <Volume1 />
  ) : (
    <Volume2 />
  );
  function handlePress() {
    setValue(mute ? previousValue : 0);
    setMute(!mute);
  }
  function handleChangeEnd(value: SliderValue) {
    if (value) setPreviousValue(value);
    else setMute(true);
  }
  return (
    <Slider
      aria-label="Volume"
      color="foreground"
      startContent={
        <Button isIconOnly radius="full" variant="light" onPress={handlePress}>
          {volumeIcon}
        </Button>
      }
      value={value}
      onChange={setValue}
      onChangeEnd={handleChangeEnd}
    />
  );
}
