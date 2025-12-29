// Onboarding Content Configuration
// ================================
// Edit the text content below to customize your onboarding experience.
// Each page has: id, title, description, and image placeholder.

export interface OnboardingPage {
    id: string;
    title: string;
    description: string;
    image: any; // Placeholder - can be replaced with actual image imports
}

export const ONBOARDING_PAGES: OnboardingPage[] = [
    {
        id: '1',
        title: 'Wakey Wakey',
        description: 'You always hit snooze without thinking?\n Wakey is here to help you wake up on time!',
        image: null, // Replace with: require('@/assets/images/onboarding1.png')
    },
    {
        id: '2',
        title: 'Snooze Button Is the Problem',
        description: 'Normal alarm apps snooze button is the problem.\n “10 more minutes” becomes 1 hour.',
        image: null,
    },
    {
        id: '3',
        title: 'Quick Math Challenges',
        description: 'Solve math problems to turn off alarm. The perfect way to jumpstart your brain each morning.',
        image: null,
    },
    {
        id: '4',
        title: 'Activities to jolt you up',
        description: 'Fun activities helps you wake up faster.',
        image: null,
    },
    {
        id: '5',
        title: 'Wake up on time',
        description: 'Wakey is built to stop the habit — not enable it.',
        image: null,
    },
    {
        id: '6',
        title: 'No more Tap. Snooze. Sleep.',
        description: 'Build a real morning habit.',
        image: null,
    },
];

// Button text configuration
export const BUTTON_TEXT = {
    next: 'NEXT',
    getStarted: 'GET STARTED',
};
