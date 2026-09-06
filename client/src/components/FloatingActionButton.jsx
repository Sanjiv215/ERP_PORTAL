import { Plus } from 'lucide-react';

export function FloatingActionButton({ onClick, label = 'Add', icon: Icon = Plus, title }) {
  return (
    <button
      type="button"
      className="mobile-fab"
      onClick={onClick}
      aria-label={label}
      title={title || label}
    >
      <Icon size={24} />
      {label && <span className="mobile-fab-label">{label}</span>}
    </button>
  );
}
