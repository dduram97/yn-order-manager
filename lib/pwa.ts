/** PWA/SW는 HTTPS production 환경에서만 활성화 */
export function shouldEnablePwa(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV === "development") return false;
  return window.location.protocol === "https:";
}

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
