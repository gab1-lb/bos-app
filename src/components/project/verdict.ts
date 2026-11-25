/** Verdict du screening : classes (bandeau, pastille), libellés et motifs, partagés par la synthèse, l'accueil, Mes dossiers et la note de comité. */
import type { Screen, ScreenReason } from '../../engine/types';

export const VCLS = { go: '', nego: 'warn', wait: 'warn', stop: 'red' } as const;
export const CCLS = { go: 'good', nego: 'amber', wait: 'amber', stop: 'bad' } as const;
export const TAG = { go: 'À poursuivre', nego: 'À négocier', wait: 'À compléter', stop: 'Réserves' } as const;

const HEAD: Record<string, string> = { go: 'Opportunité à poursuivre', nego: 'Prix à négocier', price: 'Prix à obtenir', coverage: 'Données insuffisantes', mandate: 'Cible hors mandat', weak: 'Réserves fortes' };
export const MKEY: Record<string, string> = { geo: 'Zone géographique', sector: 'Secteur', minRev: 'CA minimum', maxRev: 'CA maximum', minRecurring: 'Récurrence minimale', minMargin: 'Marge d’EBITDA minimale' };

/** Titre (clé FR) de l'avis préliminaire. */
export const headlineKey = (sc: Screen): string =>
  sc.code === 'go' ? HEAD.go : sc.code === 'nego' ? HEAD.nego : HEAD[sc.sub ?? ''] || HEAD.weak;

type Fx = { t(k: string, ...a: (string | number)[]): string; pc(n: number, d?: number): string };

/** Phrase expliquant un motif de l'avis, dans la langue de `f`. */
export function reasonText(r: ScreenReason, f: Fx): string {
  switch (r[0]) {
    case 'go': return f.t('TRI de {0} au prix d’entrée, au-dessus du seuil de {1}.', f.pc(r[1]), f.pc(r[2], 0));
    case 'nego': return f.t('TRI de {0} au prix d’entrée, sous le seuil de {1}.', f.pc(r[1]), f.pc(r[2], 0));
    case 'noPrice': return f.t('Sans prix demandé ni VE d’entrée, le rendement ne peut pas être jugé.');
    case 'coverage': return f.t('Couverture de la grille : {0}. Seuil de décision : 70 %.', f.pc(r[1], 0));
    case 'weak': return f.t('Qualité de l’actif ou rendement insuffisants au regard de la grille.');
    case 'ko': return f.t('Critère du mandat non satisfait : {0}.', r[1].map((x) => f.t(MKEY[x]).toLowerCase()).join(', '));
    case 'openQ': return r[1] > 1 ? f.t('{0} questions décisives restent ouvertes.', r[1]) : f.t('Une question décisive reste ouverte.');
    case 'unknown': return f.t('Critère du mandat à documenter : {0}.', r[1].map((x) => f.t(MKEY[x]).toLowerCase()).join(', '));
  }
}
