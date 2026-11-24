import type { Recipient } from '../engine/types';
import { t, type Locale } from '../i18n/format';

export const RECIPIENTS: Recipient[] = ['director', 'seller', 'associate', 'committee', 'internal'];

const FR: Record<Recipient, string> = {
  director: 'Dirigeant',
  seller: 'Vendeur ou banquier',
  associate: 'Associate',
  committee: 'Comité',
  internal: 'Interne',
};

export const recipientLabel = (locale: Locale, r: Recipient): string => t(locale, FR[r]);
