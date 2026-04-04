
export const titleBar = {
  backgroundColor: '#000',
  borderBottomLeftRadius: 32,
  borderBottomRightRadius: 32,
  paddingTop: 48,
  paddingBottom: 24,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  width: '100%' as const,
  minWidth: '100%' as const,
  maxWidth: '100%' as const,
  position: 'relative' as const,
  marginBottom: 0,
  overflow: 'hidden' as const,
};

export const titleText = {
  color: '#fff',
  fontSize: 26,
  fontWeight: 'bold' as const,
  letterSpacing: 1,
  textAlign: 'center' as const,
  alignSelf: 'center' as const,
  width: 400 as const, // Use a number for width to satisfy TextStyle
};

export default { titleBar, titleText };
