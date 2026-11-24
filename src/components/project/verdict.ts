/** Verdict du screening : classes (bandeau, pastille) et libellés, partagés par la synthèse et l'accueil. */
export const VCLS = { go: '', nego: 'warn', wait: 'warn', stop: 'red' } as const;
export const CCLS = { go: 'good', nego: 'amber', wait: 'amber', stop: 'bad' } as const;
export const TAG = { go: 'À poursuivre', nego: 'À négocier', wait: 'À compléter', stop: 'Réserves' } as const;
