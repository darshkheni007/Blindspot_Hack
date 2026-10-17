/**
 * Job queue abstraction. The MVP uses an in-process queue; swap `getQueue()` for a BullMQ / Inngest
 * adapter implementing the same interface. Job state lives in the database (AnalysisRun), not here,
 * so a restart never loses the status shown in the UI.
 */
export interface Job {
  id: string;
  /** Jobs with the same key run one at a time (e.g. one analysis per project). */
  key: string;
  run: () => Promise<void>;
}

export interface Queue {
  enqueue(job: Job): void;
  /** Resolves when no jobs are pending or running (tests, graceful shutdown). */
  idle(): Promise<void>;
}

export class InProcessQueue implements Queue {
  private pending: Job[] = [];
  private runningKeys = new Set<string>();
  private active = 0;
  private waiters: Array<() => void> = [];
  constructor(private concurrency = 2) {}

  enqueue(job: Job) {
    this.pending.push(job);
    queueMicrotask(() => this.pump());
  }

  private pump() {
    while (this.active < this.concurrency) {
      const i = this.pending.findIndex((j) => !this.runningKeys.has(j.key));
      if (i === -1) break;
      const [job] = this.pending.splice(i, 1);
      this.active++;
      this.runningKeys.add(job.key);
      job
        .run()
        .catch(() => {
          /* run() records its own failure state; never crash the process */
        })
        .finally(() => {
          this.active--;
          this.runningKeys.delete(job.key);
          this.pump();
          if (this.active === 0 && this.pending.length === 0) this.waiters.splice(0).forEach((w) => w());
        });
    }
  }

  idle() {
    if (this.active === 0 && this.pending.length === 0) return Promise.resolve();
    return new Promise<void>((resolve) => this.waiters.push(resolve));
  }
}

const g = globalThis as unknown as { __queue?: Queue };
export function getQueue(): Queue {
  g.__queue ??= new InProcessQueue();
  return g.__queue;
}
