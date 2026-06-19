type StatusValue = 'ok' | 'warn' | 'error' | 'idle';

interface StatusDotProps {
  status: StatusValue;
  label?: string;
}

const colorMap: Record<StatusValue, string> = {
  ok: 'bg-green-500',
  warn: 'bg-yellow-400',
  error: 'bg-red-500',
  idle: 'bg-gray-400',
};

const labelColorMap: Record<StatusValue, string> = {
  ok: 'text-green-700',
  warn: 'text-yellow-700',
  error: 'text-red-700',
  idle: 'text-gray-500',
};

export function StatusDot({ status, label }: StatusDotProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${colorMap[status]}`}
        aria-hidden="true"
      />
      {label && (
        <span className={`text-xs font-medium ${labelColorMap[status]}`}>{label}</span>
      )}
    </span>
  );
}
