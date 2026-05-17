/** Returns singular/plural morphological variants of a word or short phrase. */
export function stemVariants(word: string): string[] {
  const w = word.toLowerCase();
  const variants = new Set([w]);
  let base = w;
  if (w.endsWith('ies') && w.length > 4) base = w.slice(0, -3) + 'y';
  else if (w.endsWith('ves') && w.length > 4) { base = w.slice(0, -3) + 'f'; variants.add(w.slice(0, -3) + 'fe'); }
  else if (w.endsWith('es') && w.length > 4) base = w.slice(0, -2);
  else if (w.endsWith('s') && w.length > 3) base = w.slice(0, -1);
  variants.add(base);
  variants.add(base + 's');
  if (base.endsWith('y')) variants.add(base.slice(0, -1) + 'ies');
  if (base.endsWith('f')) variants.add(base.slice(0, -1) + 'ves');
  if (base.endsWith('fe')) variants.add(base.slice(0, -2) + 'ves');
  if (base.endsWith('o')) variants.add(base + 'es');
  return [...variants];
}
