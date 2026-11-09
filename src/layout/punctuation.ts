/** Japanese half-width punctuation classes. Iteration marks and ellipses retain
 * their own full-width advances; they are not compressed by Unicode category. */
export function punctuationClass(text: string): 'open' | 'close' | 'stop' | undefined {
  if (/^[「『（〔【〈《]$/u.test(text)) return 'open';
  if (/^[」』）〕】〉》]$/u.test(text)) return 'close';
  if (/^[、。，．]$/u.test(text)) return 'stop';
  return undefined;
}
