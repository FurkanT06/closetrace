'use client';
import {
  Info,
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Plus,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  FolderOpen,
  Files,
  History,
  Settings2,
  HelpCircle,
  Check,
  CheckCheck,
  CircleCheck,
  CircleAlert,
  AlertTriangle,
  FileText,
  Download,
  Upload,
  MoreHorizontal,
  CalendarDays,
  Clock3,
  ShieldCheck,
  Link2,
  ExternalLink,
  Pencil,
  MessageSquare,
  SlidersHorizontal,
  Command,
  LoaderCircle,
  Menu,
  Copy,
  CheckCircle2,
  LockKeyhole,
  Database,
  Building2,
  FileCheck2,
  ListChecks,
  RefreshCw,
  Circle,
  ChevronLeft,
  Inbox,
  Paperclip,
  Eye,
  FileSpreadsheet,
  LogIn,
  CheckSquare2,
} from 'lucide-react';
import { STATE_LABELS } from '../../lib/engine.js';
const icons = {
  info: Info,
  files: Files,
  arrow: ArrowUpRight,
  right: ArrowRight,
  back: ArrowLeft,
  plus: Plus,
  search: Search,
  close: X,
  down: ChevronDown,
  chevron: ChevronRight,
  overview: LayoutDashboard,
  reviews: FolderOpen,
  evidence: Files,
  activity: History,
  settings: Settings2,
  help: HelpCircle,
  check: Check,
  checks: CheckCheck,
  success: CircleCheck,
  alert: CircleAlert,
  warning: AlertTriangle,
  file: FileText,
  download: Download,
  upload: Upload,
  more: MoreHorizontal,
  calendar: CalendarDays,
  clock: Clock3,
  shield: ShieldCheck,
  link: Link2,
  external: ExternalLink,
  edit: Pencil,
  message: MessageSquare,
  filter: SlidersHorizontal,
  command: Command,
  spinner: LoaderCircle,
  menu: Menu,
  copy: Copy,
  done: CheckCircle2,
  lock: LockKeyhole,
  database: Database,
  building: Building2,
  filecheck: FileCheck2,
  checklist: ListChecks,
  refresh: RefreshCw,
  circle: Circle,
  left: ChevronLeft,
  inbox: Inbox,
  clip: Paperclip,
  eye: Eye,
  sheet: FileSpreadsheet,
  signin: LogIn,
  squarecheck: CheckSquare2,
};
export function Icon({ name, size = 18, ...props }) {
  const I = icons[name] || FileText;
  return <I size={size} strokeWidth={1.7} aria-hidden="true" {...props} />;
}
export function Logo({ compact = false }) {
  return (
    <span className="brand">
      <span className="brand-mark">
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M22 7H13L6 16l7 9h9M13 16h13"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {!compact && (
        <span>
          CloseTrace<span className="brand-period">.</span>
        </span>
      )}
    </span>
  );
}
export function Badge({ state }) {
  return (
    <span className={'badge ' + state}>
      <span className="status-dot" />
      {STATE_LABELS[state] || state}
    </span>
  );
}
export function Avatar({ name = 'You', className = '', index = 0 }) {
  const initials =
    name === 'You'
      ? 'Y'
      : name
          .split(/[\s@]+/)
          .map((w) => w[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();
  return <span className={'avatar tone-' + (index % 6) + ' ' + className}>{initials}</span>;
}
export function Button({ children, icon, variant = 'secondary', className = '', ...props }) {
  return (
    <button className={'button ' + variant + ' ' + className} {...props}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}
export function IconButton({ icon, label, ...props }) {
  return (
    <button className="icon-button" aria-label={label} title={label} {...props}>
      <Icon name={icon} />
    </button>
  );
}
export function Empty({ icon = 'inbox', title, children, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={28} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function CardHead({ title, subtitle, action }) {
  return (
    <div className="card-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export const date = (v) => {
  if (!v) return 'No due date';
  const d = new Date(v.length === 10 ? v + 'T12:00:00Z' : v);
  return Number.isFinite(d.getTime())
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: v.length === 10 ? 'UTC' : 'America/New_York',
        ...(v.length > 10 ? { hour: 'numeric', minute: '2-digit' } : {}),
      }).format(d)
    : '—';
};
export const fullDate = (v) =>
  v
    ? new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(v.slice(0, 10) + 'T12:00:00Z'))
    : 'Not set';
export const size = (n) =>
  n >= 1000000 ? (n / 1000000).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1000)) + ' KB';
export const shortMoney = (cents) =>
  cents === null
    ? '—'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(cents / 100);
