// Piece edge types: FLAT (border), TAB (protruding), BLANK (indented)
export type EdgeType = 'flat' | 'tab' | 'blank';

// Position on the canvas
export interface Position {
  x: number;
  y: number;
}

// Piece edge configuration
export interface PieceEdges {
  top: EdgeType;
  right: EdgeType;
  bottom: EdgeType;
  left: EdgeType;
}

// Individual puzzle piece
export interface Piece {
  id: number;
  row: number;
  col: number;
  edges: PieceEdges;
  position: Position;       // Current position on canvas
  correctPosition: Position; // Where it should be when solved
  groupId: number;          // Which group this piece belongs to
  isPlaced: boolean;        // Whether it's been moved from bank
  width: number;
  height: number;
}

// Group of connected pieces
export interface PieceGroup {
  id: number;
  pieceIds: Set<number>;
  position: Position;       // Offset for the entire group
}

// Game difficulty settings
export interface DifficultyLevel {
  name: string;
  cols: number;
  rows: number;
  pieceCount: number;
}

// Game state for persistence
export interface GameState {
  imageUrl: string;
  imageSeed: number;
  difficulty: DifficultyLevel;
  pieces: Piece[];
  groups: PieceGroup[];
  elapsedTime: number;
  isComplete: boolean;
  startedAt: number;
}

// Available difficulty levels
export const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  { name: 'Muy Fácil', cols: 6, rows: 4, pieceCount: 24 },
  { name: 'Fácil', cols: 8, rows: 6, pieceCount: 48 },
  { name: 'Normal', cols: 12, rows: 8, pieceCount: 96 },
  { name: 'Difícil', cols: 15, rows: 10, pieceCount: 150 },
  { name: 'Muy Difícil', cols: 20, rows: 12, pieceCount: 240 },
  { name: 'Extremo', cols: 25, rows: 12, pieceCount: 300 },
];

// Image dimensions
export const IMAGE_WIDTH = 1200;
export const IMAGE_HEIGHT = 800;

// Snap threshold in pixels
export const SNAP_THRESHOLD = 25;

// Tab size relative to piece size
export const TAB_SIZE_RATIO = 0.25;
