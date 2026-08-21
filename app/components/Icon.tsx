"use client";

import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Binary,
  BookOpen,
  Box,
  Boxes,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Clock,
  CreditCard,
  Download,
  FileJson,
  FileSearch,
  Fingerprint,
  Gauge,
  Hash,
  Info,
  LayoutDashboard,
  ListChecks,
  Menu,
  Plug,
  Radar,
  RotateCcw,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  Terminal,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";

const REGISTRY = {
  activity: Activity,
  arrowRight: ArrowRight,
  arrowUpRight: ArrowUpRight,
  badge: BadgeCheck,
  binary: Binary,
  book: BookOpen,
  box: Box,
  boxes: Boxes,
  check: Check,
  chevronDown: ChevronDown,
  circleAlert: CircleAlert,
  circleCheck: CircleCheck,
  clock: Clock,
  credit: CreditCard,
  download: Download,
  fileJson: FileJson,
  fingerprint: Fingerprint,
  gauge: Gauge,
  hash: Hash,
  info: Info,
  inspect: FileSearch,
  layout: LayoutDashboard,
  listChecks: ListChecks,
  menu: Menu,
  plug: Plug,
  radar: Radar,
  reset: RotateCcw,
  scan: ScanLine,
  search: Search,
  settings: Settings,
  shield: ShieldCheck,
  terminal: Terminal,
  triangleAlert: TriangleAlert,
  upload: Upload,
  close: X,
} as const;

export type IconName = keyof typeof REGISTRY;

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.6,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const Glyph = REGISTRY[name];
  return (
    <Glyph
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
      focusable="false"
    />
  );
}
