// Writes e2e/fixtures/im-atlas.pdf: a tiny, valid, hand-written PDF (one page, Helvetica, WinAnsi text)
// used by the e2e test of the IM import. Run: node scripts/make-im-fixture.mjs
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const LINES = [
  'Projet Atlas - Information memorandum (fictif)',
  'Secteur : Logiciel métier',
  'Pays : France',
  'Exercice clos en 2025',
  "Chiffre d'affaires : 12,4 M€",
  'EBITDA : 3,1 M€',
  'Revenus récurrents : 78 %',
  'Churn clients : 4,5 %',
  'Dette nette : 1,2 M€',
];

// WinAnsiEncoding: Latin-1 plus € at 0x80.
const winAnsi = (s) => Buffer.from([...s].map((ch) => (ch === '€' ? 0x80 : ch.charCodeAt(0))));
const pdfString = (s) => Buffer.concat([Buffer.from('('), Buffer.from(winAnsi(s).toString('latin1').replace(/[()\\]/g, (c) => '\\' + c), 'latin1'), Buffer.from(')')]);

const content = Buffer.concat([
  Buffer.from('BT /F1 12 Tf 16 TL 72 760 Td\n'),
  ...LINES.flatMap((l) => [pdfString(l), Buffer.from(" '\n")]),
  Buffer.from('ET\n'),
]);

const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  null, // content stream
];

const parts = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
const offsets = [];
let size = parts[0].length;
objects.forEach((o, i) => {
  const body = o === null
    ? Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`), content, Buffer.from('endstream')])
    : Buffer.from(o);
  const obj = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), body, Buffer.from('\nendobj\n')]);
  offsets.push(size);
  parts.push(obj);
  size += obj.length;
});
const xref = [`xref\n0 ${objects.length + 1}\n`, '0000000000 65535 f \n', ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)].join('');
parts.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`));

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'e2e', 'fixtures', 'im-atlas.pdf');
writeFileSync(out, Buffer.concat(parts));
console.log(`wrote ${out}`);
