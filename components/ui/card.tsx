interface CardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Card({ title, description, children, className = "" }: CardProps) {
  return (
    <section
      className={`rounded-xl border border-zinc-200 bg-white p-5 shadow-sm ${className}`}
    >
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
          )}
          {description && (
            <p className="mt-1 text-xs text-zinc-500">{description}</p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
