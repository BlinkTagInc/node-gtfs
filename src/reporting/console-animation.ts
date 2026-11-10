import { clearScreenDown, cursorTo, moveCursor } from 'node:readline';

import { getTerminalDisplayWidth } from './console-progress.ts';

const SPINNER_FRAMES = [
  '⠋',
  '⠙',
  '⠹',
  '⠸',
  '⠼',
  '⠴',
  '⠦',
  '⠧',
  '⠇',
  '⠏',
] as const;
const FRAME_INTERVAL_MS = 80;

type RenderAnimationFrame = (frame: {
  readonly columns: number;
  readonly spinnerFrame: string;
  readonly tick: number;
}) => readonly string[];

export function createConsoleAnimation(stream: NodeJS.WritableStream) {
  let renderedLineWidths: number[] = [];
  let spinnerFrameIndex = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let renderFrame: RenderAnimationFrame | undefined;
  let animationTick = 0;
  let lastRender = 0;

  function getColumns() {
    const value = (stream as NodeJS.WritableStream & { columns?: number })
      .columns;
    return value !== undefined && Number.isFinite(value) && value >= 1
      ? Math.floor(value)
      : 80;
  }

  function stop() {
    if (timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
    renderFrame = undefined;
  }

  function clearProgress() {
    if (renderedLineWidths.length === 0) {
      return;
    }
    const rows = renderedLineWidths.reduce(
      (sum, width) => sum + Math.max(1, Math.ceil(width / getColumns())),
      0,
    );
    cursorTo(stream, 0);
    moveCursor(stream, 0, -(rows - 1));
    clearScreenDown(stream);
    renderedLineWidths = [];
  }

  function render() {
    if (renderFrame === undefined) {
      return;
    }
    clearProgress();
    const lines = renderFrame({
      columns: getColumns(),
      spinnerFrame: SPINNER_FRAMES[spinnerFrameIndex] ?? SPINNER_FRAMES[0],
      tick: animationTick++,
    });
    stream.write(lines.join('\n'));
    renderedLineWidths = lines.map(getTerminalDisplayWidth);
    lastRender = Date.now();
    spinnerFrameIndex = (spinnerFrameIndex + 1) % SPINNER_FRAMES.length;
  }

  return {
    getColumns,
    stop,
    writeLine(text: string) {
      stop();
      clearProgress();
      stream.write(`${text}\n`);
    },
    animate(nextFrame: RenderAnimationFrame) {
      const alreadyAnimating = renderFrame !== undefined;
      renderFrame = nextFrame;
      if (!alreadyAnimating || Date.now() - lastRender >= FRAME_INTERVAL_MS) {
        render();
      }
      if (timer === undefined) {
        timer = setInterval(render, FRAME_INTERVAL_MS);
        timer.unref();
      }
    },
  };
}
