import { GameWorkerHandler } from './game-worker-handler';
import type { WorkerRequest } from './game-worker-protocol';

/**
 * The actual Worker entry point — bundled into its own chunk wherever `InProcessGameGateway`
 * constructs `new Worker(new URL('./game.worker', import.meta.url))` (native support in
 * `@angular/build`'s esbuild-based bundler, no extra config needed). Kept to just this wiring;
 * all real logic lives in `GameWorkerHandler` so it stays unit-testable without a Worker
 * runtime. Running the engine here means the ISMCTS bot's up-to-1s synchronous search never
 * blocks the main (UI) thread.
 */
const handler = new GameWorkerHandler();

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  handler.handle(event.data, (response) => self.postMessage(response));
};
