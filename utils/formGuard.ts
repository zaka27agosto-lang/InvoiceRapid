import { Alert } from 'react-native';

interface FormGuard {
  hasUnsaved: boolean;
  _t: ((key: string) => string) | null;
  setT(t: (key: string) => string): void;
  showConfirm(onLeave: () => void): void;
}

export const formGuard: FormGuard = {
  hasUnsaved: false,
  _t: null,
  setT(t: (key: string) => string) {
    this._t = t;
  },
  showConfirm(onLeave: () => void) {
    const t = this._t || ((k: string) => k);
    Alert.alert(
      '',
      t('confirmar_salir_factura_cambios'),
      [
        { text: t('cancelar'), style: 'cancel' },
        { text: t('salir'), onPress: onLeave },
      ]
    );
  },
};
