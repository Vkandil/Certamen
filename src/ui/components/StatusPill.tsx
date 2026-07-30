import type { CertamenStatus, ResponsioStatus } from '../../domain/types';

export function StatusPill({ status }: { status: CertamenStatus | ResponsioStatus }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-ink-muted">
      <span className="status-square" data-state={stateKind(status)} aria-hidden />
      <span>{labels[status] ?? status}</span>
    </span>
  );
}

const labels: Record<string, string> = {
  pending: 'waiting',
  streaming: 'streaming',
  done: 'done',
  failed: 'failed',
  timeout: 'timeout',
  aborted: 'aborted',
  truncated: 'truncated',
  filtered: 'filtered',
  draft: 'draft',
  running: 'running',
  completed: 'completed',
  partial: 'partial'
};

function stateKind(status: CertamenStatus | ResponsioStatus): 'done' | 'streaming' | 'waiting' | 'failed' {
  if (status === 'done' || status === 'completed') return 'done';
  if (status === 'streaming' || status === 'running') return 'streaming';
  if (status === 'pending' || status === 'draft') return 'waiting';
  return 'failed';
}
