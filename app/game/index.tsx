import { Redirect } from 'expo-router';

export default function GameIndex() {
    // Always redirect to the sequence game
    return <Redirect href="/game/sequence" />;
}

