/** Minimal shared theme tokens so screens/components stay visually consistent. */
export const colors = {
  bg: '#0E1116',
  surface: '#171B22',
  surfaceAlt: '#1F242D',
  border: '#2A313C',
  text: '#E6E9EF',
  textMuted: '#9AA4B2',
  primary: '#4C8DFF',
  success: '#33C77F',
  warning: '#E5A93C',
  danger: '#E5564B',
  skip: '#F26722',
};

export const status = {
  OFF: colors.textMuted,
  STARTING: colors.warning,
  RUNNING: colors.success,
  ERROR: colors.danger,
};

export const spacing = (n: number) => n * 8;
