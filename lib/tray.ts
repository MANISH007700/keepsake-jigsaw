export type TrayFit = {
  columns: number;
  rows: number;
  scale: number;
};

export function fitTrayLayout(
  count: number,
  trayWidth: number,
  trayHeight: number,
  pieceWidth: number,
  pieceHeight: number,
  gap = 8,
): TrayFit {
  if (count <= 0 || trayWidth <= 0 || trayHeight <= 0 || pieceWidth <= 0 || pieceHeight <= 0) {
    return { columns: 1, rows: 1, scale: 1 };
  }

  let best: TrayFit = { columns: 1, rows: count, scale: 0 };
  for (let columns = 1; columns <= count; columns += 1) {
    const rows = Math.ceil(count / columns);
    const usableWidth = trayWidth - gap * (columns + 1);
    const usableHeight = trayHeight - gap * (rows + 1);
    const scale = Math.min(0.9, usableWidth / (columns * pieceWidth), usableHeight / (rows * pieceHeight));
    if (scale > best.scale) best = { columns, rows, scale };
  }

  return { ...best, scale: Math.max(0.04, best.scale) };
}

export function boundedPilePoint(
  index: number,
  count: number,
  trayWidth: number,
  trayHeight: number,
  visualWidth: number,
  visualHeight: number,
  gap = 8,
) {
  const availableX = Math.max(0, trayWidth - visualWidth - gap * 2);
  const availableY = Math.max(0, trayHeight - visualHeight - gap * 2);
  const angle = index * 2.399963229728653;
  const radius = count <= 1 ? 0 : Math.sqrt(index / (count - 1));
  const centerX = gap + availableX / 2;
  const centerY = gap + availableY / 2;
  return {
    x: centerX + Math.cos(angle) * availableX * 0.46 * radius,
    y: centerY + Math.sin(angle) * availableY * 0.46 * radius,
  };
}
