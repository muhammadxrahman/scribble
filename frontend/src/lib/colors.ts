export function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Convert to hue (0-360)
  const hue = Math.abs(hash % 360);
  
  // Return HSL color with good saturation and lightness
  return `hsl(${hue}, 70%, 50%)`;
}