// FIXED: only `card` existed. Components that reached for SHADOW.sm/md/lg via
// this module spread `undefined` into their styles.
export const SHADOW = {
  card: {
    shadowColor:   "#000",
    shadowOpacity: 0.05,
    shadowRadius:  20,
    shadowOffset:  { width: 0, height: 8 },
    elevation:     4,
  },
  sm: {
    shadowColor:   "#000",
    shadowOpacity: 0.05,
    shadowRadius:  2,
    shadowOffset:  { width: 0, height: 1 },
    elevation:     1,
  },
  md: {
    shadowColor:   "#000",
    shadowOpacity: 0.07,
    shadowRadius:  8,
    shadowOffset:  { width: 0, height: 3 },
    elevation:     3,
  },
  lg: {
    shadowColor:   "#000",
    shadowOpacity: 0.1,
    shadowRadius:  16,
    shadowOffset:  { width: 0, height: 8 },
    elevation:     6,
  },
};