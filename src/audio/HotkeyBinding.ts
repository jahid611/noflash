/**
 * Seam de portage desktop (§12).
 *
 * Impl web  : BrowserHotkey (keydown/keyup sur window — ne marche que si
 *             l'onglet a le focus, limite connue du web).
 * Impl desktop (plus tard) : raccourci global Electron, y compris les
 *             boutons pouce de la souris.
 */
export interface HotkeyHandlers {
  onDown(): void;
  onUp(): void;
}

export interface HotkeyBinding {
  /** `code` au format KeyboardEvent.code ("KeyV", "F4", …). */
  bind(code: string, handlers: HotkeyHandlers): void;
  unbind(): void;
}
