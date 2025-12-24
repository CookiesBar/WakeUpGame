import { Colors } from '@/constants/theme';
import { Stack } from 'expo-router';

export default function GameLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                gestureEnabled: false,
                animation: 'fade',
                contentStyle: { backgroundColor: Colors.gameBackground },
            }}
        />
    );
}
