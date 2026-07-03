import type { HotkeyBinding, HotkeyHandlers } from './HotkeyBinding';

export class BrowserHotkey implements HotkeyBinding {
  private code: string | null = null;
  private handlers: HotkeyHandlers | null = null;
  private isDown = false;
  private attached = false;

  bind(code: string, handlers: HotkeyHandlers): void {
    this.forceUp();
    this.code = code;
    this.handlers = handlers;
    if (!this.attached) {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      window.addEventListener('blur', this.onBlur);
      this.attached = true;
    }
  }

  unbind(): void {
    this.forceUp();
    if (this.attached) {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      window.removeEventListener('blur', this.onBlur);
      this.attached = false;
    }
    this.code = null;
    this.handlers = null;
  }

  /** Relâche si la touche était enfoncée (perte de focus, rebind…). */
  private forceUp(): void {
    if (this.isDown) {
      this.isDown = false;
      this.handlers?.onUp();
    }
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return (
      target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
    );
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code !== this.code || e.repeat || this.isEditableTarget(e.target)) return;
    e.preventDefault();
    if (!this.isDown) {
      this.isDown = true;
      this.handlers?.onDown();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code !== this.code) return;
    if (this.isDown) {
      this.isDown = false;
      this.handlers?.onUp();
    }
  };

  private onBlur = (): void => this.forceUp();
}
