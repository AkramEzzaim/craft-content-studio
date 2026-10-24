export function rawFingerprint(source: string): string {
  const value = source.replace(/\r\n?/g, "\n").trim();
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return `${value.length}-${(hash >>> 0).toString(16)}`;
}
