import type { ReactNode } from 'react';
import { Search } from 'lucide-react';

export function ViewHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <header className="view-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="view-actions">{actions}</div>}
    </header>
  );
}

export function SearchField({ value, onChange, placeholder = 'Cerca…' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="search-field">
      <Search size={16} aria-hidden="true" />
      <span className="sr-only">Cerca</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{children}</p></div>;
}
