import type { Piece, DifficultyLevel } from '../types';
import { SNAP_THRESHOLD, IMAGE_WIDTH, IMAGE_HEIGHT } from '../types';
import type { GroupManager } from './GroupManager';
import { audioService } from '../services/AudioService';

interface SnapResult {
  snapped: boolean;
  targetPiece?: Piece;
  newGroupId?: number;
}

export class SnapEngine {
  private pieces: Piece[] = [];
  private groupManager: GroupManager;
  private difficulty: DifficultyLevel;

  constructor(groupManager: GroupManager) {
    this.groupManager = groupManager;
    this.difficulty = { name: '', cols: 0, rows: 0, pieceCount: 0 };
  }

  initialize(pieces: Piece[], difficulty: DifficultyLevel): void {
    this.pieces = pieces;
    this.difficulty = difficulty;
  }

  // Check if a piece/group can snap to any adjacent pieces
  checkSnap(movedPiece: Piece): SnapResult {
    const movedGroup = this.groupManager.getGroup(movedPiece.groupId);
    if (!movedGroup) return { snapped: false };

    const movedPieceIds = movedGroup.pieceIds;
    const pieceWidth = IMAGE_WIDTH / this.difficulty.cols;
    const pieceHeight = IMAGE_HEIGHT / this.difficulty.rows;

    // Check all pieces in the moved group against all other pieces
    for (const pieceId of movedPieceIds) {
      const piece = this.pieces.find(p => p.id === pieceId);
      if (!piece) continue;

      // Check each neighbor direction
      const neighbors = this.getAdjacentPieceIds(piece);
      
      for (const neighborId of neighbors) {
        if (neighborId < 0 || neighborId >= this.pieces.length) continue;
        
        const neighbor = this.pieces[neighborId];
        if (!neighbor || movedPieceIds.has(neighborId)) continue;

        // Calculate where this piece should be relative to neighbor
        const rowDiff = piece.row - neighbor.row;
        const colDiff = piece.col - neighbor.col;
        
        const expectedX = neighbor.position.x + colDiff * pieceWidth;
        const expectedY = neighbor.position.y + rowDiff * pieceHeight;
        
        const dx = Math.abs(piece.position.x - expectedX);
        const dy = Math.abs(piece.position.y - expectedY);
        
        if (dx < SNAP_THRESHOLD && dy < SNAP_THRESHOLD) {
          // Snap!
          this.snapPiecesToNeighbor(movedPieceIds, piece, neighbor, pieceWidth, pieceHeight);
          
          const newGroupId = this.groupManager.mergeGroups(
            movedPiece.groupId, 
            neighbor.groupId, 
            this.pieces
          );
          
          audioService.play('snap');
          
          return { 
            snapped: true, 
            targetPiece: neighbor,
            newGroupId 
          };
        }
      }
    }

    return { snapped: false };
  }

  private getAdjacentPieceIds(piece: Piece): number[] {
    const { row, col } = piece;
    const { cols, rows } = this.difficulty;
    const neighbors: number[] = [];

    // Top
    if (row > 0) neighbors.push((row - 1) * cols + col);
    // Bottom
    if (row < rows - 1) neighbors.push((row + 1) * cols + col);
    // Left
    if (col > 0) neighbors.push(row * cols + (col - 1));
    // Right
    if (col < cols - 1) neighbors.push(row * cols + (col + 1));

    return neighbors;
  }

  private snapPiecesToNeighbor(
    movedPieceIds: Set<number>,
    piece: Piece,
    neighbor: Piece,
    pieceWidth: number,
    pieceHeight: number
  ): void {
    // Calculate the offset to snap piece to neighbor
    const rowDiff = piece.row - neighbor.row;
    const colDiff = piece.col - neighbor.col;
    
    const targetX = neighbor.position.x + colDiff * pieceWidth;
    const targetY = neighbor.position.y + rowDiff * pieceHeight;
    
    const offsetX = targetX - piece.position.x;
    const offsetY = targetY - piece.position.y;
    
    // Move all pieces in the group by this offset
    for (const pieceId of movedPieceIds) {
      const p = this.pieces.find(pi => pi.id === pieceId);
      if (p) {
        p.position.x += offsetX;
        p.position.y += offsetY;
      }
    }
  }

  // Recursively check for more snaps after a snap occurs
  checkAllSnaps(startPiece: Piece): number {
    let snapCount = 0;
    let snapped = true;
    
    while (snapped) {
      const group = this.groupManager.getGroup(startPiece.groupId);
      if (!group) break;
      
      snapped = false;
      
      for (const pieceId of group.pieceIds) {
        const piece = this.pieces.find(p => p.id === pieceId);
        if (!piece) continue;
        
        const result = this.checkSnap(piece);
        if (result.snapped) {
          snapCount++;
          snapped = true;
          break; // Restart the loop with updated group
        }
      }
    }
    
    return snapCount;
  }
}
