/**
 * OTA update availability for the Settings update card.
 * The card must never claim "Up to Date" when it cannot actually check.
 */

export type UpdateAvailability = "checkable" | "disabled";

/**
 * Release builds with the updates module enabled can check EAS for updates.
 * Dev builds (__DEV__) and builds with updates disabled cannot.
 */
export const resolveUpdateAvailability = (
  isDev: boolean,
  isUpdatesEnabled: boolean
): UpdateAvailability => (isDev || !isUpdatesEnabled ? "disabled" : "checkable");
