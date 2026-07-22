export interface ImagePreloadResult {
  loaded: string[];
  failed: string[];
  timedOut: boolean;
}

export async function preloadImages(
  urls: string[],
  timeoutMs: number,
): Promise<ImagePreloadResult> {
  const uniqueUrls = [...new Set(urls)];
  const loaded: string[] = [];
  const failed: string[] = [];
  let timedOut = false;

  const jobs = uniqueUrls.map(
    (url) =>
      new Promise<void>((resolve) => {
        const image = new Image();
        image.onload = () => {
          loaded.push(url);
          resolve();
        };
        image.onerror = () => {
          failed.push(url);
          resolve();
        };
        image.src = url;
      }),
  );
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.all(jobs),
    new Promise<void>((resolve) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        resolve();
      }, timeoutMs);
    }),
  ]);
  if (timeoutId) clearTimeout(timeoutId);
  return { loaded, failed, timedOut };
}
