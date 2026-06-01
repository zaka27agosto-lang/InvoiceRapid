type PremiumListener = (isPremium: boolean) => void;

let listeners: PremiumListener[] = [];

export function notifyPremiumChange(isPremium: boolean) {
  listeners.forEach((listener) => {
    listener(isPremium);
  });
}

export function onPremiumChange(callback: PremiumListener) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}
