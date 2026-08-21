export function debounce<Args extends unknown[]>(fn: (...args: Args) => void, tundaMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const terdebounce = (...args: Args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), tundaMs);
  };
  terdebounce.batalkan = () => {
    if (timer) clearTimeout(timer);
  };
  return terdebounce;
}
