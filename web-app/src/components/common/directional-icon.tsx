export function DirectionalIcon({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <span className={`inline-flex rtl:-scale-x-100 ${className ?? ''}`}>{children}</span>;
}
