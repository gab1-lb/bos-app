/** Téléchargement navigateur classique (Blob + lien <a download>). */
export function download(filename: string, data: Blob | string, type = 'text/html'): void {
  const blob = data instanceof Blob ? data : new Blob([data], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Nom de fichier sans accents ni caractères spéciaux (legacy `slug`). */
export const slug = (s: string): string =>
  (s || 'dossier').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'dossier';
