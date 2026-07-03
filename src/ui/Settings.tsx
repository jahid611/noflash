import { useEffect, useState } from 'react';
import { addToast } from './state/logStore';
import { championService } from './state/runtime';
import { DEFAULT_MODEL_URL, keyCodeLabel, useSettingsStore } from './state/settingsStore';
import { disableVoice, useVoiceStore } from './state/voiceRuntime';

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-zinc-800/70 py-3 last:border-0">
      <div className="min-w-[220px]">
        <p className="text-sm font-semibold text-zinc-200">{label}</p>
        {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      </div>
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`h-6 w-11 rounded-full border transition ${
        checked ? 'border-emerald-500/60 bg-emerald-500/30' : 'border-zinc-700 bg-zinc-800'
      }`}
    >
      <span
        className={`block h-4 w-4 rounded-full bg-zinc-100 transition ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export function SettingsView() {
  const settings = useSettingsStore();
  const grammarSize = useVoiceStore((s) => s.grammarSize);
  const phase = useVoiceStore((s) => s.phase);
  const [capturingKey, setCapturingKey] = useState(false);

  useEffect(() => {
    if (!capturingKey) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      settings.set({ pttKeyCode: e.code });
      setCapturingKey(false);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [capturingKey, settings]);

  return (
    <section className="mx-auto max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <h2 className="mb-1 text-base font-bold">Réglages</h2>

      <Row label="Touche push-to-talk" hint="Maintenir pour parler (défaut V)">
        <button
          onClick={() => setCapturingKey(true)}
          className={`rounded-lg border px-4 py-1.5 text-sm font-bold ${
            capturingKey
              ? 'animate-pulse border-amber-400/70 text-amber-300'
              : 'border-zinc-700 text-zinc-200 hover:border-zinc-500'
          }`}
        >
          {capturingKey ? 'Appuie sur une touche…' : keyCodeLabel(settings.pttKeyCode)}
        </button>
      </Row>

      <Row
        label="Micro always-on"
        hint="Écoute continue au lieu du PTT — plus de bruit, moins de précision"
      >
        <Switch checked={settings.alwaysOn} onChange={(v) => settings.set({ alwaysOn: v })} />
      </Row>

      <Row label="Confirmation TTS" hint="Annonce vocale des commandes reconnues">
        <Switch checked={settings.ttsEnabled} onChange={(v) => settings.set({ ttsEnabled: v })} />
      </Row>

      <Row label="Langue du TTS">
        <select
          value={settings.ttsLang}
          onChange={(e) => settings.set({ ttsLang: e.target.value as 'en-US' | 'fr-FR' })}
          className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
        >
          <option value="en-US">English</option>
          <option value="fr-FR">Français</option>
        </select>
      </Row>

      <Row
        label="Tracking des ults à charges"
        hint="Expérimental : ajoute la fenêtre de recast (Ahri, Kha'Zix…) au CD"
      >
        <Switch
          checked={settings.chargeTracking}
          onChange={(v) => settings.set({ chargeTracking: v })}
        />
      </Row>

      <Row
        label="URL du modèle vosk"
        hint="Fichier .tar.gz servi depuis public/model/ — voir README"
      >
        <input
          value={settings.modelUrl}
          onChange={(e) => settings.set({ modelUrl: e.target.value || DEFAULT_MODEL_URL })}
          className="w-72 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-xs"
        />
      </Row>

      <Row
        label="Cache données champions"
        hint="ddragon est mis en cache localStorage par version"
      >
        <button
          onClick={() => {
            championService.clearCache();
            addToast('info', 'Cache ddragon vidé — recharge la page');
          }}
          className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300 hover:border-red-500/60"
        >
          Vider le cache
        </button>
      </Row>

      <p className="pt-3 text-xs text-zinc-600">
        État voix : {phase}
        {grammarSize > 0 && ` — grammaire fermée de ${grammarSize} tokens`}. Un
        changement d'URL de modèle nécessite de désactiver puis réactiver la voix
        {phase === 'ready' && (
          <button onClick={() => disableVoice()} className="ml-1 underline">
            (désactiver)
          </button>
        )}
        .
      </p>
    </section>
  );
}
