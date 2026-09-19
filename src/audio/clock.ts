// 拍の基準時刻。AudioContext.currentTime（ms 換算）を使い、動かせなければ performance.now() に落とす。
// core には now() の値だけを渡す。
export interface Clock {
  now(): number;
  /** AudioContext を基準にしているか */
  readonly audio: boolean;
  readonly context: AudioContext | null;
}

export function createClock(): Clock {
  let context: AudioContext | null;
  try {
    context = new AudioContext({ latencyHint: 'interactive' });
  } catch {
    context = null;
  }
  let useAudio = false;
  if (context) {
    void context.resume().then(() => {
      useAudio = context.state === 'running';
    });
  }
  return {
    get audio() {
      return useAudio;
    },
    context,
    now() {
      if (useAudio && context && context.state === 'running') return context.currentTime * 1000;
      return performance.now();
    },
  };
}
