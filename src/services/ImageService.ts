import { IMAGE_WIDTH, IMAGE_HEIGHT } from '../types';

const PICSUM_BASE_URL = 'https://picsum.photos';

export class ImageService {
  private currentSeed: number = 0;
  private loadedImage: HTMLImageElement | null = null;

  generateNewSeed(): number {
    this.currentSeed = Math.floor(Math.random() * 100000);
    return this.currentSeed;
  }

  getSeed(): number {
    return this.currentSeed;
  }

  setSeed(seed: number): void {
    this.currentSeed = seed;
  }

  getImageUrl(): string {
    return `${PICSUM_BASE_URL}/seed/${this.currentSeed}/${IMAGE_WIDTH}/${IMAGE_HEIGHT}`;
  }

  async loadImage(): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.loadedImage = img;
        resolve(img);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = this.getImageUrl();
    });
  }

  getLoadedImage(): HTMLImageElement | null {
    return this.loadedImage;
  }
}

export const imageService = new ImageService();
