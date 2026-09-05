"use client";

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Binary,
  Blend,
  BookOpen,
  Box,
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  Contrast,
  Copy,
  CreditCard,
  Cuboid,
  Download,
  FileJson,
  FileSearch,
  FlipHorizontal,
  Folder,
  Fingerprint,
  Gauge,
  Grid3x3,
  Hash,
  Info,
  Image as ImageIcon,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Maximize,
  Menu,
  Orbit,
  Palette,
  Plug,
  Pyramid,
  Radar,
  RotateCcw,
  Ruler,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  Terminal,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";

/**
 * 2026-09-05: 아래 `contrast`~`wireframe` 열한 줄은 3D 작업대 툴바(EmbeddedGlbViewer)가
 * 쓰던 이모지 열세 개를 대신한다. 이모지는 같은 font-size 16.8px 로 지정해도 실제
 * 가로폭이 8.0px(⤓)에서 23.1px(🎨·📏·🔆)까지 벌어졌다 — 컬러 이모지와 흑백 기호가
 * 섞여 있어 서체마다 자간이 다르기 때문이다. 여기 아이콘은 전부 같은 선 굵기의 SVG라
 * 넘겨준 size 그대로 그려진다.
 */
const REGISTRY = {
  activity: Activity,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  arrowUpRight: ArrowUpRight,
  badge: BadgeCheck,
  binary: Binary,
  book: BookOpen,
  box: Box,
  boxes: Boxes,
  check: Check,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  circleAlert: CircleAlert,
  circleCheck: CircleCheck,
  clock: Clock,
  /** 배경 밝기 전환. 반쯤 칠한 원 — 예전 ◐/◑ 가 그리려던 바로 그 모양. */
  contrast: Contrast,
  copy: Copy,
  credit: CreditCard,
  download: Download,
  /** 플랫 셰이딩. 평평한 면이 각각 보이는 입체라서 "면 보기"가 눈으로 읽힌다. */
  facets: Pyramid,
  fileJson: FileJson,
  folder: Folder,
  fingerprint: Fingerprint,
  fullscreen: Maximize,
  gauge: Gauge,
  /** 격자 바닥. */
  grid: Grid3x3,
  hash: Hash,
  info: Info,
  image: ImageIcon,
  inspect: FileSearch,
  layout: LayoutDashboard,
  /** 조명 프리셋 전환. */
  lighting: Lightbulb,
  listChecks: ListChecks,
  menu: Menu,
  /** 좌우 반전. */
  mirror: FlipHorizontal,
  /** 자동 회전. 카메라가 도는 것이지 모델이 뒤집히는 게 아니라 궤도 기호를 쓴다. */
  orbit: Orbit,
  /** 재질 색 바꾸기. */
  palette: Palette,
  plug: Plug,
  radar: Radar,
  reset: RotateCcw,
  /** 치수 상자. */
  ruler: Ruler,
  scan: ScanLine,
  search: Search,
  settings: Settings,
  /** 그림자. 물체와 그 아래 깔린 그늘이 겹친 모양. */
  shadow: Blend,
  shield: ShieldCheck,
  terminal: Terminal,
  triangleAlert: TriangleAlert,
  upload: Upload,
  /** 와이어프레임. 뒷면 모서리까지 비쳐 보이는 상자. */
  wireframe: Cuboid,
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
