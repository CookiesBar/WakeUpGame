// AlarmKit (iOS 26+): alarms that ring through Silent and Focus.
// Null on Android, older iOS builds and Expo Go, where notifications do the job alone.
import { requireOptionalNativeModule } from 'expo';

export type AlarmKitAuth = 'authorized' | 'denied' | 'notDetermined' | 'unsupported';

interface WakeyAlarmNative {
    isSupported(): boolean;
    authorizationState(): AlarmKitAuth;
    requestAuthorization(): Promise<AlarmKitAuth>;
    /** openText: a Play button that opens the app into the game (builds before it ignore the extra argument). */
    schedule(id: string, epochMs: number, title: string, stopText: string, sound: string | null, rearm: boolean, openText: string | null): Promise<void>;
    /** The AlarmKit id whose Play button opened the app, once. Builds before Play lack it. */
    takeOpenRequest?(): string | null;
    /** AlarmKit ids ringing right now (lowercase). Builds before it lack it. */
    alertingIds?(): string[];
    /** Builds from before the Yes / No check lack these three. */
    scheduleCheck?(id: string, epochMs: number, title: string, yesText: string, noText: string, sound: string | null, checkId: string): Promise<void>;
    linkToCheck?(checkId: string, id: string): void;
    takeCheckAnswers?(): Record<string, 'yes' | 'no'>;
    cancel(id: string): void;
    stopAlerting(): void;
}

const native = requireOptionalNativeModule<WakeyAlarmNative>('WakeyAlarm');

export const alarmKit = native?.isSupported() ? native : null;
