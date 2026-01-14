import type { Piece, PieceGroup } from '../types';

export class GroupManager {
  private groups: Map<number, PieceGroup> = new Map();
  private nextGroupId: number = 0;

  initialize(pieces: Piece[]): void {
    this.groups.clear();
    this.nextGroupId = 0;
    
    // Each piece starts in its own group
    pieces.forEach(piece => {
      const group: PieceGroup = {
        id: this.nextGroupId++,
        pieceIds: new Set([piece.id]),
        position: { x: 0, y: 0 }
      };
      this.groups.set(group.id, group);
      piece.groupId = group.id;
    });
  }

  loadGroups(groups: PieceGroup[], pieces: Piece[]): void {
    this.groups.clear();
    this.nextGroupId = 0;
    
    groups.forEach(g => {
      this.groups.set(g.id, {
        ...g,
        pieceIds: new Set(g.pieceIds)
      });
      if (g.id >= this.nextGroupId) {
        this.nextGroupId = g.id + 1;
      }
    });

    // Update piece groupIds
    pieces.forEach(piece => {
      for (const [groupId, group] of this.groups) {
        if (group.pieceIds.has(piece.id)) {
          piece.groupId = groupId;
          break;
        }
      }
    });
  }

  getGroup(groupId: number): PieceGroup | undefined {
    return this.groups.get(groupId);
  }

  getGroupByPieceId(pieceId: number): PieceGroup | undefined {
    for (const group of this.groups.values()) {
      if (group.pieceIds.has(pieceId)) {
        return group;
      }
    }
    return undefined;
  }

  getPiecesInGroup(groupId: number): number[] {
    const group = this.groups.get(groupId);
    return group ? Array.from(group.pieceIds) : [];
  }

  mergeGroups(groupId1: number, groupId2: number, pieces: Piece[]): number {
    if (groupId1 === groupId2) return groupId1;

    const group1 = this.groups.get(groupId1);
    const group2 = this.groups.get(groupId2);

    if (!group1 || !group2) return groupId1;

    // Merge group2 into group1
    group2.pieceIds.forEach(pieceId => {
      group1.pieceIds.add(pieceId);
      const piece = pieces.find(p => p.id === pieceId);
      if (piece) {
        piece.groupId = group1.id;
      }
    });

    // Remove group2
    this.groups.delete(groupId2);

    return group1.id;
  }

  getAllGroups(): PieceGroup[] {
    return Array.from(this.groups.values());
  }

  getGroupCount(): number {
    return this.groups.size;
  }

  // Check if puzzle is complete (all pieces in one group)
  isComplete(): boolean {
    return this.groups.size === 1;
  }
}

export const groupManager = new GroupManager();
