import { EventEmitter } from 'events';

const premiumEventEmitter = new EventEmitter();

export function notifyPremiumChange(isPremium: boolean) {
  premiumEventEmitter.emit('premiumChanged', isPremium);
}

export function onPremiumChange(callback: (isPremium: boolean) => void) {
  premiumEventEmitter.on('premiumChanged', callback);
  return () => premiumEventEmitter.off('premiumChanged', callback);
}
