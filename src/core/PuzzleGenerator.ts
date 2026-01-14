import type { Piece, PieceEdges, EdgeType, DifficultyLevel } from '../types';
import { IMAGE_WIDTH, IMAGE_HEIGHT, TAB_SIZE_RATIO } from '../types';

export class PuzzleGenerator {
  private difficulty: DifficultyLevel;
  private pieces: Piece[] = [];
  private edgesGrid: EdgeType[][] = [];

  constructor(difficulty: DifficultyLevel) {
    this.difficulty = difficulty;
  }

  generate(): Piece[] {
    this.generateEdges();
    this.generatePieces();
    return this.pieces;
  }

  private generateEdges(): void {
    const { cols, rows } = this.difficulty;
    
    // Generate horizontal edges (between rows)
    // rows+1 horizontal lines, cols edges per line
    const horizontalEdges: EdgeType[][] = [];
    for (let row = 0; row <= rows; row++) {
      horizontalEdges[row] = [];
      for (let col = 0; col < cols; col++) {
        if (row === 0 || row === rows) {
          horizontalEdges[row][col] = 'flat';
        } else {
          horizontalEdges[row][col] = Math.random() > 0.5 ? 'tab' : 'blank';
        }
      }
    }

    // Generate vertical edges (between cols)
    // rows lines, cols+1 edges per line
    const verticalEdges: EdgeType[][] = [];
    for (let row = 0; row < rows; row++) {
      verticalEdges[row] = [];
      for (let col = 0; col <= cols; col++) {
        if (col === 0 || col === cols) {
          verticalEdges[row][col] = 'flat';
        } else {
          verticalEdges[row][col] = Math.random() > 0.5 ? 'tab' : 'blank';
        }
      }
    }

    // Store edges for each piece
    this.edgesGrid = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const pieceEdges: PieceEdges = {
          top: horizontalEdges[row][col],
          bottom: this.invertEdge(horizontalEdges[row + 1][col]),
          left: verticalEdges[row][col],
          right: this.invertEdge(verticalEdges[row][col + 1])
        };
        this.edgesGrid.push(pieceEdges as unknown as EdgeType[]);
      }
    }
  }

  private invertEdge(edge: EdgeType): EdgeType {
    if (edge === 'tab') return 'blank';
    if (edge === 'blank') return 'tab';
    return 'flat';
  }

  private generatePieces(): void {
    const { cols, rows } = this.difficulty;
    const pieceWidth = IMAGE_WIDTH / cols;
    const pieceHeight = IMAGE_HEIGHT / rows;

    this.pieces = [];
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const id = row * cols + col;
        const edgesArray = this.edgesGrid[id] as unknown as PieceEdges;
        
        const piece: Piece = {
          id,
          row,
          col,
          edges: edgesArray,
          position: { x: 0, y: 0 }, // Will be set when scattered
          correctPosition: {
            x: col * pieceWidth,
            y: row * pieceHeight
          },
          groupId: id, // Initially each piece is its own group
          isPlaced: false,
          width: pieceWidth,
          height: pieceHeight
        };
        
        this.pieces.push(piece);
      }
    }
  }

  // Generate SVG path for a piece shape with bezier curves for tabs
  static generatePiecePath(
    piece: Piece,
    tabSize: number = TAB_SIZE_RATIO
  ): string {
    const { width, height, edges } = piece;
    const tabWidth = width * tabSize;
    const tabHeight = height * tabSize;
    
    let path = '';
    
    // Start at top-left
    path += `M 0 0 `;
    
    // Top edge
    path += this.generateEdgePath(edges.top, width, tabWidth, tabHeight, 'horizontal', false);
    
    // Right edge
    path += this.generateEdgePath(edges.right, height, tabHeight, tabWidth, 'vertical', false);
    
    // Bottom edge (reversed)
    path += this.generateEdgePath(edges.bottom, width, tabWidth, tabHeight, 'horizontal', true);
    
    // Left edge (reversed)
    path += this.generateEdgePath(edges.left, height, tabHeight, tabWidth, 'vertical', true);
    
    path += 'Z';
    
    return path;
  }

  private static generateEdgePath(
    edgeType: EdgeType,
    length: number,
    tabW: number,
    tabH: number,
    direction: 'horizontal' | 'vertical',
    reversed: boolean
  ): string {
    if (edgeType === 'flat') {
      if (direction === 'horizontal') {
        return reversed ? `L 0 ${length} ` : `L ${length} 0 `;
      } else {
        return reversed ? `L 0 0 ` : `L ${length} ${length} `;
      }
    }

    const third = length / 3;
    const isTab = edgeType === 'tab';
    const sign = (isTab ? 1 : -1) * (reversed ? -1 : 1);
    
    // Simplified edge with bump in the middle
    if (direction === 'horizontal' && !reversed) {
      // Moving left to right along top
      return `L ${third} 0 ` +
             `C ${third} ${sign * tabH * 0.2}, ${third + tabW * 0.5} ${sign * tabH}, ${length / 2} ${sign * tabH} ` +
             `C ${length / 2 + tabW * 0.5} ${sign * tabH}, ${2 * third} ${sign * tabH * 0.2}, ${2 * third} 0 ` +
             `L ${length} 0 `;
    } else if (direction === 'horizontal' && reversed) {
      // Moving right to left along bottom
      return `L ${2 * third} ${length} ` +
             `C ${2 * third} ${length + sign * tabH * 0.2}, ${length / 2 + tabW * 0.5} ${length + sign * tabH}, ${length / 2} ${length + sign * tabH} ` +
             `C ${length / 2 - tabW * 0.5} ${length + sign * tabH}, ${third} ${length + sign * tabH * 0.2}, ${third} ${length} ` +
             `L 0 ${length} `;
    } else if (direction === 'vertical' && !reversed) {
      // Moving top to bottom along right side
      return `L ${length} ${third} ` +
             `C ${length + sign * tabW * 0.2} ${third}, ${length + sign * tabW} ${third + tabH * 0.5}, ${length + sign * tabW} ${length / 2} ` +
             `C ${length + sign * tabW} ${length / 2 + tabH * 0.5}, ${length + sign * tabW * 0.2} ${2 * third}, ${length} ${2 * third} ` +
             `L ${length} ${length} `;
    } else {
      // Moving bottom to top along left side
      return `L 0 ${2 * third} ` +
             `C ${sign * tabW * 0.2} ${2 * third}, ${sign * tabW} ${length / 2 + tabH * 0.5}, ${sign * tabW} ${length / 2} ` +
             `C ${sign * tabW} ${third + tabH * 0.5}, ${sign * tabW * 0.2} ${third}, 0 ${third} ` +
             `L 0 0 `;
    }
  }

  getDifficulty(): DifficultyLevel {
    return this.difficulty;
  }
}
