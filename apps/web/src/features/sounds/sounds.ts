import type { UiSound } from '@tempi/core';
import { createSoundEngine, type PresetName } from '@usesounds/core';

/** Core lists the sounds a user can pick; this fails to compile if one of them isn't a built-in preset. */
export const presetOf = (sound: UiSound): PresetName => sound;

// Separate from the app's engine, which stays muted until sounds are saved as on: picking a sound in the settings
// form plays it even while the switch is turned on but not saved yet.
const previewEngine = createSoundEngine();

/** Plays a sound as a preview, e.g. when it's picked in the settings. */
export const previewSound = (sound: UiSound): void => previewEngine.play(presetOf(sound));
