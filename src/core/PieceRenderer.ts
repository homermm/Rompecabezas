import type { Piece } from '../types';
import { TAB_SIZE_RATIO } from '../types';
import { PuzzleGenerator } from './PuzzleGenerator';

export class PieceRenderer {
  private image: HTMLImageElement | null = null;
  private pieceCanvases: Map<number, HTMLCanvasElement> = new Map();
  private scale: number = 1;

  constructor() {
    // Constructor requires no parameters
  }

  setImage(image: HTMLImageElement): void {
    this.image = image;
    this.pieceCanvases.clear();
  }

  setScale(scale: number): void {
    this.scale = scale;
    this.pieceCanvases.clear(); // Clear cache when scale changes
  }

  getScale(): number {
    return this.scale;
  }

  private getPieceCanvas(piece: Piece): HTMLCanvasElement {
    if (this.pieceCanvases.has(piece.id)) {
      return this.pieceCanvases.get(piece.id)!;
    }

    const canvas = this.renderPieceToCanvas(piece);
    this.pieceCanvases.set(piece.id, canvas);
    return canvas;
  }

  private renderPieceToCanvas(piece: Piece): HTMLCanvasElement {
    const { width, height } = piece;
    const tabSize = Math.max(width, height) * TAB_SIZE_RATIO;
    
    // Account for tabs extending beyond piece bounds
    const canvasWidth = width + tabSize * 2;
    const canvasHeight = height + tabSize * 2;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth * this.scale;
    canvas.height = canvasHeight * this.scale;
    
    const ctx = canvas.getContext('2d')!;
    ctx.scale(this.scale, this.scale);
    
    // Translate to account for tab space
    ctx.translate(tabSize, tabSize);
    
    // Create clip path
    const path = new Path2D(PuzzleGenerator.generatePiecePath(piece));
    
    // Draw piece with clipping
    ctx.save();
    ctx.clip(path);
    
    if (this.image) {
      // Calculate source position in original image
      const srcX = piece.col * width;
      const srcY = piece.row * height;
      
      // Draw the image portion
      ctx.drawImage(
        this.image,
        srcX - tabSize, srcY - tabSize,
        canvasWidth, canvasHeight,
        -tabSize, -tabSize,
        canvasWidth, canvasHeight
      );
    }
    
    ctx.restore();
    
    // Draw drop shadow for depth
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke(path);
    ctx.restore();
    
    // Draw white outline for contrast on dark backgrounds
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke(path);
    
    // Draw inner subtle dark line for definition
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 0.5;
    ctx.stroke(path);
    
    return canvas;
  }

  renderPiece(
    ctx: CanvasRenderingContext2D,
    piece: Piece,
    highlight: boolean = false
  ): void {
    const pieceCanvas = this.getPieceCanvas(piece);
    const tabSize = Math.max(piece.width, piece.height) * TAB_SIZE_RATIO;
    
    if (highlight) {
      ctx.save();
      ctx.shadowColor = 'rgba(66, 153, 225, 0.8)';
      ctx.shadowBlur = 15;
    }
    
    ctx.drawImage(
      pieceCanvas,
      (piece.position.x - tabSize) * this.scale,
      (piece.position.y - tabSize) * this.scale
    );
    
    if (highlight) {
      ctx.restore();
    }
  }

  getPieceBounds(piece: Piece): { x: number; y: number; width: number; height: number } {
    const tabSize = Math.max(piece.width, piece.height) * TAB_SIZE_RATIO;
    return {
      x: piece.position.x - tabSize,
      y: piece.position.y - tabSize,
      width: piece.width + tabSize * 2,
      height: piece.height + tabSize * 2
    };
  }

  isPointInPiece(piece: Piece, x: number, y: number): boolean {
    const bounds = this.getPieceBounds(piece);
    
    // First check bounding box
    if (
      x < bounds.x || x > bounds.x + bounds.width ||
      y < bounds.y || y > bounds.y + bounds.height
    ) {
      return false;
    }
    
    // For more accurate hit testing, check the path
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    
    // Generate path for accurate hit testing
    
    // Translate the path to piece position
    const piecePath = PuzzleGenerator.generatePiecePath(piece);
    const m = new DOMMatrix();
    m.translateSelf(piece.position.x, piece.position.y);
    
    const transformedPath = new Path2D();
    transformedPath.addPath(new Path2D(piecePath), m);
    
    return ctx.isPointInPath(transformedPath, x, y);
  }

  clearCache(): void {
    this.pieceCanvases.clear();
  }
}
