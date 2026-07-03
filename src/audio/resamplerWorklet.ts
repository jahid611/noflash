export const RESAMPLER_PROCESSOR_NAME = 'noflash-resampler';

/**
 * AudioWorkletProcessor (pattern recommandé par vosk-browser) : capture le PCM
 * du micro, rééchantillonne vers 16 kHz (interpolation linéaire) et poste des
 * chunks Float32Array vers le main thread. Injecté via Blob URL pour éviter
 * toute config bundler dédiée.
 */
export const RESAMPLER_WORKLET_SOURCE = `
class NoFlashResampler extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const target = (options && options.processorOptions && options.processorOptions.targetSampleRate) || 16000;
    this.ratio = sampleRate / target;      // sampleRate = rate natif du contexte (worklet global)
    this.readPos = 0;
    this.fifo = new Float32Array(0);
    this.pending = [];
    this.flushEvery = 1600;                // ~100 ms de son à 16 kHz
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (input && input.length) {
      const merged = new Float32Array(this.fifo.length + input.length);
      merged.set(this.fifo, 0);
      merged.set(input, this.fifo.length);
      this.fifo = merged;

      while (this.readPos + 1 < this.fifo.length) {
        const i = Math.floor(this.readPos);
        const frac = this.readPos - i;
        this.pending.push(this.fifo[i] * (1 - frac) + this.fifo[i + 1] * frac);
        this.readPos += this.ratio;
      }

      const consumed = Math.floor(this.readPos);
      if (consumed > 0) {
        this.fifo = this.fifo.slice(consumed);
        this.readPos -= consumed;
      }

      if (this.pending.length >= this.flushEvery) {
        const chunk = new Float32Array(this.pending);
        this.pending.length = 0;
        this.port.postMessage({ samples: chunk }, [chunk.buffer]);
      }
    }
    return true;
  }
}
registerProcessor('${RESAMPLER_PROCESSOR_NAME}', NoFlashResampler);
`;
