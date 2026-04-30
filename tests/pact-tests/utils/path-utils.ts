import path from 'node:path';

export function getPathFromProvider(provider: string): string {
  return path.resolve(__dirname, `../.pacts/${provider}`);
}

export function getPactFilePath(consumer: string, provider: string): any {
  return path.join(
    getPathFromProvider(provider),
    `${consumer}-${provider}.json`,
  );
}
