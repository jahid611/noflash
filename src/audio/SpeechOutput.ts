/**
 * Feedback TTS (confirmation vocale). Impl web : SpeechSynthesis.
 * Impl desktop (plus tard) : TTS natif ou samples audio embarqués.
 */
export interface SpeechOutput {
  speak(text: string, lang?: string): void;
}

export class BrowserTts implements SpeechOutput {
  speak(text: string, lang = 'en-US'): void {
    if (typeof speechSynthesis === 'undefined') return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.2;
    // Une confirmation à la fois : la dernière commande a priorité.
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }
}
