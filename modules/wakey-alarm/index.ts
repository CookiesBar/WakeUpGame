// AlarmKit (iOS 26+): alarms that ring through Silent and Focus.
// Null on Android, older iOS builds and Expo Go, where notifications do the job alone.
import { requireOptionalNativeModule } from 'expo';

export type AlarmKitAuth = 'authorized' | 'denied' | 'notDetermined' | 'unsupported';

interface WakeyAlarmNative {
    isSupported(): boolean;
    authorizationState(): AlarmKitAuth;
    requestAuthorization(): Promise<AlarmKitAuth>;
    schedule(id: string, epochMs: number, title: string, stopText: string, sound: string | null, rearm: boolean): Promise<void>;
    /** Builds from before the Yes / No check lack these three. */
    scheduleCheck?(id: string, epochMs: number, title: string, yesText: string, noText: string, sound: string | null, checkId: string): Promise<void>;
    linkToCheck?(checkId: string, id: string): void;
    takeCheckAnswers?(): Record<string, 'yes' | 'no'>;
    cancel(id: string): void;
    stopAlerting(): void;
}

const native = requireOptionalNativeModule<WakeyAlarmNative>('WakeyAlarm');

export const alarmKit = native?.isSupported() ? native : null;
