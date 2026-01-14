export class TimerService {
  private startTime: number = 0;
  private elapsedTime: number = 0;
  private isRunning: boolean = false;
  private intervalId: number | null = null;
  private onUpdate: ((time: number) => void) | null = null;

  setUpdateCallback(callback: (time: number) => void): void {
    this.onUpdate = callback;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = Date.now() - this.elapsedTime;
    this.intervalId = window.setInterval(() => this.tick(), 100);
  }

  private tick(): void {
    this.elapsedTime = Date.now() - this.startTime;
    if (this.onUpdate) {
      this.onUpdate(this.elapsedTime);
    }
  }

  pause(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  reset(): void {
    this.pause();
    this.elapsedTime = 0;
    this.startTime = 0;
    if (this.onUpdate) {
      this.onUpdate(0);
    }
  }

  getElapsedTime(): number {
    return this.elapsedTime;
  }

  setElapsedTime(time: number): void {
    this.elapsedTime = time;
    this.startTime = Date.now() - time;
    if (this.onUpdate) {
      this.onUpdate(time);
    }
  }

  formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  isTimerRunning(): boolean {
    return this.isRunning;
  }
}

export const timerService = new TimerService();
