interface EmptyStateProps {
  message: string;
  action?: React.ReactNode;
}

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
      <p className="text-sm text-zinc-500">{message}</p>
      {action}
    </div>
  );
}
