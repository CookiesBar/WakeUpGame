// Theme constants for Wake Up Game - Corporate UI Style
// Light theme, no drop shadows, Google Inter font

export const Colors = {
  // Primary colors
  primary: '#1A1A2E',      // Deep navy for headers/text
  secondary: '#4A5568',    // Muted gray for secondary text
  accent: '#3B82F6',       // Clean blue accent
  
  // Background colors
  background: '#FFFFFF',   // Pure white background
  surface: '#F8FAFC',      // Slightly off-white for cards
  surfaceAlt: '#F1F5F9',   // Alternative surface
  
  // Text colors
  text: '#1A1A2E',         // Primary text
  textSecondary: '#64748B', // Secondary text
  textMuted: '#94A3B8',    // Muted/disabled text
  
  // UI elements
  border: '#E2E8F0',       // Subtle borders
  divider: '#F1F5F9',      // Dividers
  
  // Status colors
  success: '#10B981',      // Green for on/active
  danger: '#EF4444',       // Red for delete/danger
  warning: '#F59E0B',      // Orange for warnings
  
  // Game colors
  gameBackground: '#0F172A', // Dark background for games
  snake: '#10B981',         // Snake color
  fruit: '#EF4444',         // Fruit color
  bomb: '#1F2937',          // Bomb color
  dino: '#374151',          // Dino color
  ground: '#64748B',        // Ground color
  cactus: '#059669',        // Cactus color
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
  title: 48,
  clock: 72,
};

export const FontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

// No drop shadows - use borders instead
export const Elevation = {
  none: {},
  subtle: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
};

export default {
  Colors,
  Spacing,
  FontSize,
  FontFamily,
  BorderRadius,
  Elevation,
};
