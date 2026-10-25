// Helper to resolve the permanent live application URL
export function getLiveAppUrl(): string {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin;
    if (origin && origin.startsWith('http')) {
      return origin;
    }
  }
  return (
    import.meta.env.VITE_APP_URL ||
    'https://ais-dev-ltn56efv54m42d5c5dvn4l-94327014952.asia-southeast1.run.app'
  );
}
