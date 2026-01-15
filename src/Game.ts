import type { 
  Piece, 
  DifficultyLevel, 
  GameState
} from './types';
import { 
  DIFFICULTY_LEVELS, 
  IMAGE_WIDTH, 
  IMAGE_HEIGHT
} from './types';
import { PuzzleGenerator } from './core/PuzzleGenerator';
import { PieceRenderer } from './core/PieceRenderer';
import { SnapEngine } from './core/SnapEngine';
import { groupManager } from './core/GroupManager';
import { imageService } from './services/ImageService';
import { timerService } from './services/TimerService';
import { audioService } from './services/AudioService';
import { storageService } from './services/StorageService';

export class JigsawGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  private pieces: Piece[] = [];
  private renderer: PieceRenderer | null = null;
  private snapEngine: SnapEngine;
  private difficulty: DifficultyLevel = DIFFICULTY_LEVELS[2]; // Normal
  private currentDifficultyIndex: number = 2;
  
  private isDragging: boolean = false;
  private draggedPiece: Piece | null = null;
  private dragOffset: { x: number; y: number } = { x: 0, y: 0 };
  
  private showGhostImage: boolean = false;
  private isComplete: boolean = false;
  
  private canvasOffset: { x: number; y: number } = { x: 0, y: 0 };
  private zoom: number = 1;
  private readonly MIN_ZOOM = 0.3;
  private readonly MAX_ZOOM = 2;
  
  private isPanning: boolean = false;
  private panStart: { x: number; y: number } = { x: 0, y: 0 };
  private isPaused: boolean = false;

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    
    this.snapEngine = new SnapEngine(groupManager);
    
    this.setupEventListeners();
    this.setupUIListeners();
    this.resizeCanvas();
    
    // Check for saved game
    if (storageService.hasSavedGame()) {
      this.showContinueDialog();
    } else {
      this.startNewGame();
    }
  }

  private async showContinueDialog(): Promise<void> {
    const dialog = document.getElementById('continue-dialog') as HTMLDialogElement;
    dialog.showModal();
    
    document.getElementById('continue-btn')!.onclick = () => {
      dialog.close();
      this.loadSavedGame();
    };
    
    document.getElementById('new-game-btn')!.onclick = () => {
      dialog.close();
      storageService.clear();
      this.startNewGame();
    };
  }

  private async loadSavedGame(): Promise<void> {
    const state = storageService.load();
    if (!state) {
      this.startNewGame();
      return;
    }

    this.difficulty = state.difficulty;
    this.updateDifficultyUI();
    
    imageService.setSeed(state.imageSeed);
    
    try {
      await imageService.loadImage();
      this.renderer = new PieceRenderer();
      this.renderer.setImage(imageService.getLoadedImage()!);
      
      this.pieces = state.pieces;
      groupManager.loadGroups(state.groups, this.pieces);
      this.snapEngine.initialize(this.pieces, this.difficulty);
      
      timerService.setElapsedTime(state.elapsedTime);
      timerService.start();
      
      this.updateThumbnail();
      this.render();
    } catch (e) {
      console.error('Failed to load saved game:', e);
      this.startNewGame();
    }
  }

  async startNewGame(): Promise<void> {
    this.isComplete = false;
    timerService.reset();
    
    // Update difficulty from UI
    const diffSelect = document.getElementById('difficulty-select') as HTMLSelectElement;
    this.currentDifficultyIndex = parseInt(diffSelect.value);
    this.difficulty = DIFFICULTY_LEVELS[this.currentDifficultyIndex];
    
    // Generate new seed and load image
    imageService.generateNewSeed();
    this.showLoading(true);
    
    try {
      await imageService.loadImage();
      
      this.renderer = new PieceRenderer();
      this.renderer.setImage(imageService.getLoadedImage()!);
      
      // Generate pieces
      const generator = new PuzzleGenerator(this.difficulty);
      this.pieces = generator.generate();
      
      groupManager.initialize(this.pieces);
      this.snapEngine.initialize(this.pieces, this.difficulty);
      
      // Scatter pieces on the board
      this.scatterPiecesOnBoard();
      
      timerService.start();
      this.updateThumbnail();
      this.render();
      
    } catch (e) {
      console.error('Failed to start game:', e);
      alert('Error al cargar la imagen. Intenta de nuevo.');
    } finally {
      this.showLoading(false);
    }
  }

  private scatterPiecesOnBoard(): void {
    const pieceWidth = IMAGE_WIDTH / this.difficulty.cols;
    const pieceHeight = IMAGE_HEIGHT / this.difficulty.rows;
    
    // Get canvas dimensions
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    
    // Calculate the offset to center the image on the canvas
    const offsetX = (canvasWidth - IMAGE_WIDTH) / 2;
    const offsetY = (canvasHeight - IMAGE_HEIGHT) / 2;
    
    // Tab size adds extra space around pieces
    const tabExtra = pieceWidth * 0.3;
    
    // Calculate scatter bounds within the visible canvas area
    const padding = tabExtra + 10;
    const scatterMinX = padding - offsetX;
    const scatterMaxX = canvasWidth - offsetX - pieceWidth - padding;
    const scatterMinY = padding - offsetY;
    const scatterMaxY = canvasHeight - offsetY - pieceHeight - padding;
    
    // Get all unique groups
    const processedGroups = new Set<number>();
    
    // Shuffle the order of pieces for random group placement
    const shuffledPieces = [...this.pieces].sort(() => Math.random() - 0.5);
    
    shuffledPieces.forEach((piece) => {
      // Skip if this group was already processed
      if (processedGroups.has(piece.groupId)) return;
      processedGroups.add(piece.groupId);
      
      // Get all pieces in this group
      const group = groupManager.getGroup(piece.groupId);
      const groupPieces = group 
        ? this.pieces.filter(p => group.pieceIds.has(p.id))
        : [piece];
      
      // Find the "anchor" piece (first piece position in the group)
      const anchorPiece = groupPieces[0];
      
      // Calculate random position for the anchor piece
      const randomX = scatterMinX + Math.random() * Math.max(0, scatterMaxX - scatterMinX);
      const randomY = scatterMinY + Math.random() * Math.max(0, scatterMaxY - scatterMinY);
      
      // Calculate offset from anchor's current position
      const dx = randomX - anchorPiece.position.x;
      const dy = randomY - anchorPiece.position.y;
      
      // Move all pieces in the group by the same offset (preserving relative positions)
      groupPieces.forEach(p => {
        p.position.x += dx;
        p.position.y += dy;
        p.isPlaced = true;
      });
    });
    
    // Set canvas offset to center the image
    this.canvasOffset = {
      x: offsetX,
      y: offsetY
    };
  }

  private setupEventListeners(): void {
    // Main canvas events
    this.canvas.addEventListener('mousedown', this.onCanvasMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onCanvasMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onCanvasMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.onCanvasMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this.onCanvasWheel.bind(this));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Window resize
    window.addEventListener('resize', this.resizeCanvas.bind(this));
    
    // Timer update
    timerService.setUpdateCallback((time) => {
      document.getElementById('timer-display')!.textContent = timerService.formatTime(time);
    });
  }

  private setupUIListeners(): void {
    // New game
    document.getElementById('new-game-action')!.onclick = () => {
      if (confirm('¿Comenzar un nuevo puzzle?')) {
        storageService.clear();
        this.startNewGame();
      }
    };
    
    // New image (same difficulty)
    document.getElementById('new-image-btn')!.onclick = () => {
      storageService.clear();
      this.startNewGame();
    };
    
    // Pause toggle
    document.getElementById('pause-btn')!.onclick = () => this.togglePause();
    document.getElementById('resume-btn')!.onclick = () => this.togglePause();
    
    // Reset zoom
    document.getElementById('reset-zoom-btn')!.onclick = () => this.resetView();
    
    // Organize pieces
    document.getElementById('organize-btn')!.onclick = () => this.organizePieces();
    
    // Ghost image toggle
    document.getElementById('ghost-toggle')!.onclick = () => {
      this.showGhostImage = !this.showGhostImage;
      const btn = document.getElementById('ghost-toggle')!;
      btn.classList.toggle('active', this.showGhostImage);
      this.render();
    };
    
    // Fullscreen
    document.getElementById('fullscreen-btn')!.onclick = () => this.toggleFullscreen();
    
    // Sound toggle
    document.getElementById('sound-toggle')!.onclick = () => {
      const enabled = !audioService.isEnabled();
      audioService.setEnabled(enabled);
      const btn = document.getElementById('sound-toggle')!;
      btn.classList.toggle('active', enabled);
      btn.textContent = enabled ? '🔊' : '🔇';
    };
    
    // Difficulty change
    const diffSelect = document.getElementById('difficulty-select') as HTMLSelectElement;
    DIFFICULTY_LEVELS.forEach((level, index) => {
      const option = document.createElement('option');
      option.value = index.toString();
      option.textContent = `${level.name} (${level.pieceCount} piezas)`;
      diffSelect.appendChild(option);
    });
    diffSelect.value = this.currentDifficultyIndex.toString();
    
    diffSelect.addEventListener('change', () => {
      const newIndex = parseInt(diffSelect.value);
      if (newIndex === this.currentDifficultyIndex) return;
      
      if (confirm('Cambiar la dificultad reiniciará el juego actual. ¿Deseas continuar?')) {
        storageService.clear();
        this.startNewGame();
      } else {
        diffSelect.value = this.currentDifficultyIndex.toString();
      }
    });
  }

  private updateDifficultyUI(): void {
    const diffSelect = document.getElementById('difficulty-select') as HTMLSelectElement;
    const index = DIFFICULTY_LEVELS.findIndex(d => d.pieceCount === this.difficulty.pieceCount);
    if (index >= 0) {
      diffSelect.value = index.toString();
      this.currentDifficultyIndex = index;
    }
  }

  private resizeCanvas(): void {
    const gameArea = document.getElementById('game-area')!;
    
    this.canvas.width = gameArea.clientWidth;
    this.canvas.height = gameArea.clientHeight;
    
    if (this.renderer) {
      this.renderer.clearCache();
    }
    
    this.render();
  }

  private onCanvasMouseDown(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const x = (clientX - this.canvasOffset.x) / this.zoom;
    const y = (clientY - this.canvasOffset.y) / this.zoom;
    
    // Right click or middle click = start panning (allowed even when paused)
    if (e.button === 2 || e.button === 1) {
      this.startPan(clientX, clientY);
      return;
    }
    
    // If paused, only allow panning on empty area
    if (this.isPaused) {
      this.startPan(clientX, clientY);
      return;
    }
    
    // Check for piece click (reverse order to get top piece first)
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const piece = this.pieces[i];
      if (this.renderer && this.renderer.isPointInPiece(piece, x, y)) {
        this.startDrag(piece, x, y);
        return;
      }
    }
    
    // Click on empty area = start panning
    this.startPan(clientX, clientY);
  }

  private onCanvasMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    
    if (this.isPanning) {
      this.canvasOffset.x += clientX - this.panStart.x;
      this.canvasOffset.y += clientY - this.panStart.y;
      this.panStart = { x: clientX, y: clientY };
      this.render();
      return;
    }
    
    if (this.isDragging && this.draggedPiece) {
      const x = (clientX - this.canvasOffset.x) / this.zoom;
      const y = (clientY - this.canvasOffset.y) / this.zoom;
      
      this.moveDraggedPieces(x - this.dragOffset.x, y - this.dragOffset.y);
      this.render();
    }
  }

  private onCanvasMouseUp(_e: MouseEvent): void {
    if (this.isPanning) {
      this.isPanning = false;
      return;
    }
    
    if (this.isDragging && this.draggedPiece) {
      this.endDrag();
    }
  }

  private startPan(x: number, y: number): void {
    this.isPanning = true;
    this.panStart = { x, y };
  }

  private onCanvasWheel(e: WheelEvent): void {
    e.preventDefault();
    
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const oldZoom = this.zoom;
    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    this.zoom = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, this.zoom * zoomDelta));
    
    const zoomRatio = this.zoom / oldZoom;
    this.canvasOffset.x = mouseX - (mouseX - this.canvasOffset.x) * zoomRatio;
    this.canvasOffset.y = mouseY - (mouseY - this.canvasOffset.y) * zoomRatio;
    
    this.render();
  }

  private startDrag(piece: Piece, x: number, y: number): void {
    this.isDragging = true;
    this.draggedPiece = piece;
    this.dragOffset = {
      x: x - piece.position.x,
      y: y - piece.position.y
    };
    
    this.bringToFront(piece);
  }

  private bringToFront(piece: Piece): void {
    const group = groupManager.getGroup(piece.groupId);
    const groupPieceIds = group ? group.pieceIds : new Set([piece.id]);
    
    const otherPieces: Piece[] = [];
    const groupPieces: Piece[] = [];
    
    this.pieces.forEach(p => {
      if (groupPieceIds.has(p.id)) {
        groupPieces.push(p);
      } else {
        otherPieces.push(p);
      }
    });
    
    this.pieces = [...otherPieces, ...groupPieces];
  }

  private moveDraggedPieces(newX: number, newY: number): void {
    if (!this.draggedPiece) return;
    
    const dx = newX - this.draggedPiece.position.x;
    const dy = newY - this.draggedPiece.position.y;
    
    // Move all pieces in the group
    const group = groupManager.getGroup(this.draggedPiece.groupId);
    if (group) {
      group.pieceIds.forEach(id => {
        const p = this.pieces.find(pi => pi.id === id);
        if (p) {
          p.position.x += dx;
          p.position.y += dy;
        }
      });
    } else {
      this.draggedPiece.position.x = newX;
      this.draggedPiece.position.y = newY;
    }
  }

  private endDrag(): void {
    if (this.draggedPiece) {
      // Check for snaps
      const snapCount = this.snapEngine.checkAllSnaps(this.draggedPiece);
      
      if (snapCount === 0) {
        audioService.play('drop');
      }
      
      // Check for completion
      if (groupManager.isComplete()) {
        this.onPuzzleComplete();
      } else {
        // Save game state
        this.saveGame();
      }
    }
    
    this.isDragging = false;
    this.draggedPiece = null;
    
    this.render();
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    const btn = document.getElementById('pause-btn')!;
    const overlay = document.getElementById('pause-overlay')!;
    
    if (this.isPaused) {
      timerService.pause();
      btn.textContent = '▶️';
      btn.title = 'Continuar';
      document.getElementById('pause-time')!.textContent = timerService.formatTime(timerService.getElapsedTime());
      overlay.style.display = 'flex';
    } else {
      timerService.start();
      btn.textContent = '⏸️';
      btn.title = 'Pausar';
      overlay.style.display = 'none';
    }
  }

  private resetView(): void {
    this.zoom = 1;
    this.canvasOffset = {
      x: (this.canvas.width - IMAGE_WIDTH) / 2,
      y: (this.canvas.height - IMAGE_HEIGHT) / 2
    };
    this.render();
  }

  private organizePieces(): void {
    const pieceWidth = IMAGE_WIDTH / this.difficulty.cols;
    const pieceHeight = IMAGE_HEIGHT / this.difficulty.rows;
    const spacing = pieceWidth * 0.35;
    
    const largestGroupId = this.findLargestGroupId();
    
    const loosePieces = this.pieces.filter(p => p.groupId !== largestGroupId);
    const processedGroups = new Set<number>();
    const groupsToPlace: { groupId: number; pieces: Piece[] }[] = [];
    
    loosePieces.forEach(piece => {
      if (processedGroups.has(piece.groupId)) return;
      processedGroups.add(piece.groupId);
      
      const group = groupManager.getGroup(piece.groupId);
      const groupPieces = group 
        ? this.pieces.filter(p => group.pieceIds.has(p.id))
        : [piece];
      
      groupsToPlace.push({ groupId: piece.groupId, pieces: groupPieces });
    });
    
    // Shuffle groups randomly so they're not in order
    for (let i = groupsToPlace.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [groupsToPlace[i], groupsToPlace[j]] = [groupsToPlace[j], groupsToPlace[i]];
    }
    
    // Generate spiral positions around the center
    const positions = this.generateRectangularSpiral(groupsToPlace.length, pieceWidth, pieceHeight, spacing);
    
    groupsToPlace.forEach(({ pieces }, index) => {
      if (index >= positions.length) return;
      
      const anchorPiece = pieces[0];
      const { x: targetX, y: targetY } = positions[index];
      
      const dx = targetX - anchorPiece.position.x;
      const dy = targetY - anchorPiece.position.y;
      
      pieces.forEach(p => {
        p.position.x += dx;
        p.position.y += dy;
      });
    });
    
    this.resetView();
    this.saveGame();
  }

  private generateRectangularSpiral(count: number, pieceW: number, pieceH: number, spacing: number): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = [];
    const stepX = pieceW + spacing;
    const stepY = pieceH + spacing;
    
    // Center of the puzzle
    const centerX = IMAGE_WIDTH / 2;
    const centerY = IMAGE_HEIGHT / 2;
    
    // Start position just outside the puzzle area
    let ring = 1;
    
    while (positions.length < count) {
      const halfW = IMAGE_WIDTH / 2 + ring * stepX;
      const halfH = IMAGE_HEIGHT / 2 + ring * stepY;
      
      // Top edge (left to right)
      const topY = centerY - halfH;
      for (let x = centerX - halfW; x <= centerX + halfW && positions.length < count; x += stepX) {
        positions.push({ x, y: topY });
      }
      
      // Right edge (top to bottom)
      const rightX = centerX + halfW;
      for (let y = centerY - halfH + stepY; y <= centerY + halfH && positions.length < count; y += stepY) {
        positions.push({ x: rightX, y });
      }
      
      // Bottom edge (right to left)
      const bottomY = centerY + halfH;
      for (let x = centerX + halfW - stepX; x >= centerX - halfW && positions.length < count; x -= stepX) {
        positions.push({ x, y: bottomY });
      }
      
      // Left edge (bottom to top)
      const leftX = centerX - halfW;
      for (let y = centerY + halfH - stepY; y >= centerY - halfH + stepY && positions.length < count; y -= stepY) {
        positions.push({ x: leftX, y });
      }
      
      ring++;
    }
    
    return positions;
  }

  private findLargestGroupId(): number {
    const groupSizes = new Map<number, number>();
    
    this.pieces.forEach(piece => {
      const group = groupManager.getGroup(piece.groupId);
      const size = group ? group.pieceIds.size : 1;
      groupSizes.set(piece.groupId, size);
    });
    
    let largestId = -1;
    let largestSize = 0;
    
    groupSizes.forEach((size, id) => {
      if (size > largestSize) {
        largestSize = size;
        largestId = id;
      }
    });
    
    return largestId;
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw background grid
    this.drawBackground();
    
    ctx.save();
    ctx.translate(this.canvasOffset.x, this.canvasOffset.y);
    ctx.scale(this.zoom, this.zoom);
    
    // Draw ghost image if enabled
    if (this.showGhostImage && imageService.getLoadedImage()) {
      ctx.globalAlpha = 0.3;
      ctx.drawImage(imageService.getLoadedImage()!, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
      ctx.globalAlpha = 1;
    }
    
    // Draw all pieces
    this.pieces.forEach(piece => {
      if (this.renderer) {
        const isHighlighted = this.draggedPiece && piece.groupId === this.draggedPiece.groupId;
        this.renderer.renderPiece(ctx, piece, !!isHighlighted);
      }
    });
    
    ctx.restore();
  }

  private drawBackground(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw subtle grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    
    const gridSize = 50;
    const offsetX = this.canvasOffset.x % gridSize;
    const offsetY = this.canvasOffset.y % gridSize;
    
    for (let x = offsetX; x < this.canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvas.height);
      ctx.stroke();
    }
    
    for (let y = offsetY; y < this.canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvas.width, y);
      ctx.stroke();
    }
  }

  private updateThumbnail(): void {
    const img = imageService.getLoadedImage();
    if (!img) return;
    
    const thumbnail = document.getElementById('thumbnail') as HTMLImageElement;
    thumbnail.src = img.src;
  }

  private showLoading(show: boolean): void {
    const loader = document.getElementById('loading-overlay');
    if (loader) {
      loader.style.display = show ? 'flex' : 'none';
    }
  }

  private toggleFullscreen(): void {
    const app = document.getElementById('app') as HTMLElement;
    if (!document.fullscreenElement) {
      app.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }

  private onPuzzleComplete(): void {
    timerService.pause();
    this.isComplete = true;
    
    audioService.play('complete');
    
    const time = timerService.formatTime(timerService.getElapsedTime());
    
    setTimeout(() => {
      const dialog = document.getElementById('complete-dialog') as HTMLDialogElement;
      document.getElementById('final-time')!.textContent = time;
      document.getElementById('final-pieces')!.textContent = this.difficulty.pieceCount.toString();
      dialog.showModal();
      
      document.getElementById('play-again-btn')!.onclick = () => {
        dialog.close();
        storageService.clear();
        this.startNewGame();
      };
    }, 500);
    
    storageService.clear();
  }

  private saveGame(): void {
    if (this.isComplete) return;
    
    const state: GameState = {
      imageUrl: imageService.getImageUrl(),
      imageSeed: imageService.getSeed(),
      difficulty: this.difficulty,
      pieces: this.pieces,
      groups: groupManager.getAllGroups(),
      elapsedTime: timerService.getElapsedTime(),
      isComplete: this.isComplete,
      startedAt: Date.now()
    };
    
    storageService.save(state);
  }
}
