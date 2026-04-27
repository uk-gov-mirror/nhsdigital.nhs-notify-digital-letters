export function buildNhsAppResourceUrl(
  nhsAppBaseUrl: string,
  resourceId: string,
): string {
  return `${nhsAppBaseUrl}/patient/digital-letters/letter?id=${resourceId}`;
}
