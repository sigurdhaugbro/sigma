export interface GridSettings {
  visible: boolean;
  snap: boolean;
  size: number;
}

export const DEFAULT_GRID: GridSettings = { visible: false, snap: false, size: 8 };

export function clampGridSize(size: number) {
  return Math.max(4, Math.min(64, Math.round(size)));
}

export function snapValue(n: number, size: number) {
  const g = size > 0 ? size : 1;
  return Math.round(n / g) * g;
}

export function snapMaybe(n: number, grid: Pick<GridSettings, "snap" | "size">) {
  return grid.snap ? snapValue(n, grid.size) : Math.round(n);
}

export function gridBackground(size: number, color = "rgba(14,165,233,0.22)") {
  return {
    backgroundImage: `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`,
    backgroundSize: `${size}px ${size}px`,
  };
}
