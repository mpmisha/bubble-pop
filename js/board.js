// Offset-hex bubble grid: storage of settled bubbles + all cluster logic
// (neighbors, same-color flood fill, ceiling connectivity, pixel<->cell).
//
// Layout: even rows (0,2,4..) are "long" (COLS cells, not shifted); odd rows
// are shifted right by one radius and hold COLS-1 cells. Bubble diameter d,
// radius r = d/2, row height = d * sin(60deg).

const ROW_FACTOR = Math.sqrt(3) / 2; // ~0.866

class Board {
  constructor(cols) {
    this.cols = cols;
    // grid[row] = array of (colorIndex | null). Ragged: odd rows are 1 shorter.
    this.grid = [];
  }

  colsInRow(row) {
    return (row % 2 === 0) ? this.cols : this.cols - 1;
  }

  ensureRow(row) {
    while (this.grid.length <= row) {
      const r = this.grid.length;
      this.grid.push(new Array(this.colsInRow(r)).fill(null));
    }
  }

  get rowCount() {
    return this.grid.length;
  }

  inBounds(row, col) {
    if (row < 0 || row >= this.grid.length) return false;
    return col >= 0 && col < this.colsInRow(row);
  }

  get(row, col) {
    if (!this.inBounds(row, col)) return null;
    return this.grid[row][col];
  }

  set(row, col, value) {
    this.ensureRow(row);
    this.grid[row][col] = value;
  }

  clear() {
    this.grid = [];
  }

  // Neighbor cells for an offset-hex layout.
  neighbors(row, col) {
    const even = (row % 2 === 0);
    const deltas = even
      ? [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]]
      : [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]];
    const out = [];
    for (const [dr, dc] of deltas) {
      const nr = row + dr;
      const nc = col + dc;
      if (this.inBounds(nr, nc)) out.push([nr, nc]);
    }
    return out;
  }

  // Pixel center of a cell given geometry.
  cellCenter(row, col, geo) {
    const { originX, originY, d, r } = geo;
    const shift = (row % 2 === 0) ? 0 : r;
    const x = originX + r + shift + col * d;
    const y = originY + r + row * (d * ROW_FACTOR);
    return { x, y };
  }

  // Nearest cell (row,col) to a pixel point.
  pixelToCell(px, py, geo) {
    const { originX, originY, d, r } = geo;
    const rowH = d * ROW_FACTOR;
    let row = Math.round((py - originY - r) / rowH);
    if (row < 0) row = 0;
    const shift = (row % 2 === 0) ? 0 : r;
    let col = Math.round((px - originX - r - shift) / d);
    const maxCol = this.colsInRow(row) - 1;
    if (col < 0) col = 0;
    if (col > maxCol) col = maxCol;
    return { row, col };
  }

  // Same-color connected cluster starting at (row,col).
  colorCluster(row, col) {
    const target = this.get(row, col);
    if (target === null) return [];
    const seen = new Set();
    const stack = [[row, col]];
    const out = [];
    while (stack.length) {
      const [r, c] = stack.pop();
      const key = `${r},${c}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (this.get(r, c) !== target) continue;
      out.push([r, c]);
      for (const [nr, nc] of this.neighbors(r, c)) {
        if (!seen.has(`${nr},${nc}`) && this.get(nr, nc) === target) {
          stack.push([nr, nc]);
        }
      }
    }
    return out;
  }

  // All cells connected (any color) to the ceiling (row 0).
  ceilingConnected() {
    const connected = new Set();
    const stack = [];
    for (let c = 0; c < this.colsInRow(0); c++) {
      if (this.get(0, c) !== null) stack.push([0, c]);
    }
    while (stack.length) {
      const [r, c] = stack.pop();
      const key = `${r},${c}`;
      if (connected.has(key)) continue;
      connected.add(key);
      for (const [nr, nc] of this.neighbors(r, c)) {
        if (this.get(nr, nc) !== null && !connected.has(`${nr},${nc}`)) {
          stack.push([nr, nc]);
        }
      }
    }
    return connected;
  }

  // Cells that are NOT connected to the ceiling (floaters that should drop).
  floatingCells() {
    const connected = this.ceilingConnected();
    const out = [];
    for (let r = 0; r < this.grid.length; r++) {
      for (let c = 0; c < this.grid[r].length; c++) {
        if (this.get(r, c) !== null && !connected.has(`${r},${c}`)) {
          out.push([r, c]);
        }
      }
    }
    return out;
  }

  // Set of color indices currently present on the board.
  presentColors() {
    const set = new Set();
    for (const row of this.grid) {
      for (const v of row) if (v !== null) set.add(v);
    }
    return set;
  }

  isEmpty() {
    for (const row of this.grid) {
      for (const v of row) if (v !== null) return false;
    }
    return true;
  }

  // Lowest occupied pixel bottom (for danger-line detection).
  lowestOccupiedRow() {
    let lowest = -1;
    for (let r = 0; r < this.grid.length; r++) {
      for (const v of this.grid[r]) {
        if (v !== null) { lowest = r; break; }
      }
    }
    return lowest;
  }

  // Serialize / restore.
  toJSON() {
    return { cols: this.cols, grid: this.grid };
  }

  static fromJSON(obj) {
    if (!obj || !Array.isArray(obj.grid)) return null;
    const b = new Board(obj.cols);
    b.grid = obj.grid.map((row) => row.slice());
    return b;
  }
}

export { Board, ROW_FACTOR };
