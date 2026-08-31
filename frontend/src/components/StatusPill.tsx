export function StatusPill({ value }: { value: string }) { return <span className={`pill ${value.toLowerCase()}`}>{value.replace('_', ' ')}</span>; }
