import { Platform } from 'react-native';

export const FONTS = Platform.select({
  web: {
    regular:  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    medium:   '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    semiBold: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    bold:     '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  default: {
    regular:  'Inter_400Regular',
    medium:   'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    bold:     'Inter_700Bold',
  },
});

export const FONT_SIZE = {
  xs:   12,
  sm:   14,
  md:   16,
  lg:   18,
  xl:   22,
  xxl:  28,
  xxxl: 36,
};