import type { AudioChunkHandler, AudioInput } from './AudioInput';
import { RESAMPLER_PROCESSOR_NAME, RESAMPLER_WORKLET_SOURCE } from './resamplerWorklet';

/**
 * Capture micro web : getUserMedia + AudioWorklet qui rééchantillonne vers
 * 16 kHz (voir resamplerWorklet). Le flux reste ouvert en continu ; c'est la
 * couche au-dessus (voiceRuntime) qui décide de forwarder ou non les chunks
 * au recognizer (gate push-to-talk) — rouvrir le micro à chaque appui
 * ajouterait ~200ms de latence et mangerait le début du mot.
 */
export class BrowserAudioInput implements AudioInput {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioWorkletNode | null = null;
  isOpen = false;

  constructor(private readonly targetSampleRate = 16000) {}

  async open(onChunk: AudioChunkHandler): Promise<void> {
    if (this.isOpen) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    this.ctx = new AudioContext();
    await this.ctx.resume();

    const blobUrl = URL.createObjectURL(
      new Blob([RESAMPLER_WORKLET_SOURCE], { type: 'application/javascript' }),
    );
    try {
      await this.ctx.audioWorklet.addModule(blobUrl);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }

    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, RESAMPLER_PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      processorOptions: { targetSampleRate: this.targetSampleRate },
    });
    this.node.port.onmessage = (event: MessageEvent<{ samples: Float32Array }>) => {
      onChunk({ samples: event.data.samples, sampleRate: this.targetSampleRate });
    };
    this.source.connect(this.node);
    // Le processor n'écrit jamais dans sa sortie → silence, pas de larsen.
    this.node.connect(this.ctx.destination);
    this.isOpen = true;
  }

  async close(): Promise<void> {
    this.node?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    if (this.ctx && this.ctx.state !== 'closed') await this.ctx.close();
    this.node = null;
    this.source = null;
    this.ctx = null;
    this.stream = null;
    this.isOpen = false;
  }
}
