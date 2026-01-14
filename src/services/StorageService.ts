import type { GameState, PieceGroup } from '../types';

const STORAGE_KEY = 'jigsaw-puzzle-state';

export class StorageService {
  save(state: GameState): void {
    try {
      // Convert Sets to arrays for JSON serialization
      const serializable = {
        ...state,
        groups: state.groups.map(g => ({
          ...g,
          pieceIds: Array.from(g.pieceIds)
        }))
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch (e) {
      console.error('Failed to save game state:', e);
    }
  }

  load(): GameState | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      
      // Convert arrays back to Sets
      return {
        ...parsed,
        groups: parsed.groups.map((g: { id: number; pieceIds: number[]; position: { x: number; y: number } }) => ({
          ...g,
          pieceIds: new Set(g.pieceIds)
        })) as PieceGroup[]
      } as GameState;
    } catch (e) {
      console.error('Failed to load game state:', e);
      return null;
    }
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  hasSavedGame(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }
}

export const storageService = new StorageService();
