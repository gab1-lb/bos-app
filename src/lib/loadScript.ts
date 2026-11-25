/** Loads a browser script once (cdnjs libraries on demand: pdf.js, SheetJS). */
const pending = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  let p = pending.get(src);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { pending.delete(src); s.remove(); reject(new Error(`script ${src}`)); };
      document.head.appendChild(s);
    });
    pending.set(src, p);
  }
  return p;
}
