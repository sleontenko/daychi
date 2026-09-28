// Navigation intent stays in memory; never store an invitation in route params.
type Target = { label: string; resume: () => void };
let target: Target | undefined;
export function setAccessReturn(value: Target) { target = value; }
export function accessReturnLabel() { return target?.label; }
export function clearAccessReturn() { target = undefined; }
export function resumeAccessReturn() {
  const saved = target;
  target = undefined;
  saved?.resume();
  return !!saved;
}
