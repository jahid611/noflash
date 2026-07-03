import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { addToast } from '@/ui/state/logStore';
import { championService } from '@/ui/state/runtime';
import {
  DEFAULT_MODEL_URL,
  MODEL_PRESETS,
  keyCodeLabel,
  useSettingsStore,
} from '@/ui/state/settingsStore';
import { WHISPER_MODELS } from '@/voice/whisperEngine';
import { disableVoice, useVoiceStore } from '@/ui/state/voiceRuntime';

function Row({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 py-3.5">
        <div className="min-w-[220px]">
          <Label htmlFor={htmlFor} className="text-sm font-semibold">
            {label}
          </Label>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="ml-auto flex items-center gap-2">{children}</div>
      </div>
      <Separator className="last:hidden" />
    </>
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
    <Card className="mx-auto max-w-2xl">
      <CardHeader className="pb-2">
        <CardTitle>Réglages</CardTitle>
        <CardDescription>Voix, feedback et données.</CardDescription>
      </CardHeader>
      <CardContent>
        <Row
          label="Moteur de reconnaissance"
          hint="Vosk : offline, instantané, mais galère sur les noms fantasy. Whisper : IA plus robuste aux noms/accents (télécharge un modèle au 1er coup, réactive la voix après)."
        >
          <Select
            value={settings.sttEngine}
            onValueChange={(v) => settings.set({ sttEngine: v as 'vosk' | 'whisper' })}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vosk">Vosk (offline)</SelectItem>
              <SelectItem value="whisper">Whisper (IA)</SelectItem>
            </SelectContent>
          </Select>
        </Row>

        {settings.sttEngine === 'whisper' && (
          <Row
            label="Modèle Whisper"
            hint="Base = plus précis sur les noms, mais plus lourd/lent que Tiny."
          >
            <Select
              value={settings.whisperModel}
              onValueChange={(v) => settings.set({ whisperModel: v as 'tiny' | 'base' })}
            >
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tiny">{WHISPER_MODELS.tiny.label}</SelectItem>
                <SelectItem value="base">{WHISPER_MODELS.base.label}</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        )}

        {settings.sttEngine === 'whisper' && (
          <Row
            label="CDN transformers.js (avancé)"
            hint="Si Whisper ne charge pas, essaie …@3.0.2/+esm ou …/dist/transformers.min.js"
            htmlFor="whisper-cdn"
          >
            <Input
              id="whisper-cdn"
              value={settings.whisperCdnUrl}
              onChange={(e) =>
                settings.set({ whisperCdnUrl: e.target.value || settings.whisperCdnUrl })
              }
              className="w-72 font-mono text-xs"
            />
          </Row>
        )}

        <Row label="Touche push-to-talk" hint="Maintenir pour parler (défaut V)">
          <Button
            variant="outline"
            onClick={() => setCapturingKey(true)}
            className={cn('font-bold', capturingKey && 'animate-pulse border-primary text-primary')}
          >
            {capturingKey ? 'Appuie sur une touche…' : keyCodeLabel(settings.pttKeyCode)}
          </Button>
        </Row>

        <Row
          label="Micro always-on"
          hint="Écoute continue au lieu du PTT — plus de bruit, moins de précision"
          htmlFor="always-on"
        >
          <Switch
            id="always-on"
            checked={settings.alwaysOn}
            onCheckedChange={(v) => settings.set({ alwaysOn: v })}
          />
        </Row>

        <Row
          label="Anti-bruit strict ([unk])"
          hint="Laisse OFF : vosk force alors le champion le plus proche au lieu de sortir « inconnu ». ON = filtre le bruit mais rate des commandes."
          htmlFor="reject-unknown"
        >
          <Switch
            id="reject-unknown"
            checked={settings.rejectUnknown}
            onCheckedChange={(v) => settings.set({ rejectUnknown: v })}
          />
        </Row>

        <Row
          label="Confirmation TTS"
          hint="Annonce vocale des commandes reconnues"
          htmlFor="tts"
        >
          <Switch
            id="tts"
            checked={settings.ttsEnabled}
            onCheckedChange={(v) => settings.set({ ttsEnabled: v })}
          />
        </Row>

        <Row label="Langue du TTS">
          <Select
            value={settings.ttsLang}
            onValueChange={(v) => settings.set({ ttsLang: v as 'en-US' | 'fr-FR' })}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en-US">English</SelectItem>
              <SelectItem value="fr-FR">Français</SelectItem>
            </SelectContent>
          </Select>
        </Row>

        <Row
          label="Tracking des ults à charges"
          hint="Expérimental : ajoute la fenêtre de recast (Ahri, Kha'Zix…) au CD"
          htmlFor="charges"
        >
          <Switch
            id="charges"
            checked={settings.chargeTracking}
            onCheckedChange={(v) => settings.set({ chargeTracking: v })}
          />
        </Row>

        <Row
          label="Langue du modèle vocal"
          hint="Français recommandé pour un locuteur FR : le modèle acoustique colle à ta prononciation (fin des « Malphite → [unk] »). Réactive la voix après changement."
        >
          <Select
            value={
              settings.modelUrl === MODEL_PRESETS.en.url
                ? 'en'
                : settings.modelUrl === MODEL_PRESETS.fr.url
                  ? 'fr'
                  : 'custom'
            }
            onValueChange={(v) => {
              if (v === 'fr' || v === 'en') settings.set({ modelUrl: MODEL_PRESETS[v].url });
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fr">🇫🇷 {MODEL_PRESETS.fr.label}</SelectItem>
              <SelectItem value="en">🇬🇧 {MODEL_PRESETS.en.label}</SelectItem>
              {settings.modelUrl !== MODEL_PRESETS.fr.url &&
                settings.modelUrl !== MODEL_PRESETS.en.url && (
                  <SelectItem value="custom">URL personnalisée</SelectItem>
                )}
            </SelectContent>
          </Select>
        </Row>

        <Row
          label="URL du modèle (avancé)"
          hint="Override manuel du .tar.gz vosk servi depuis public/model/ — voir README"
          htmlFor="model-url"
        >
          <Input
            id="model-url"
            value={settings.modelUrl}
            onChange={(e) => settings.set({ modelUrl: e.target.value || DEFAULT_MODEL_URL })}
            className="w-72 font-mono text-xs"
          />
        </Row>

        <Row
          label="Cache données champions"
          hint="ddragon est mis en cache localStorage par version"
        >
          <Button
            variant="outline"
            onClick={() => {
              championService.clearCache();
              addToast('info', 'Cache ddragon vidé — recharge la page');
            }}
          >
            <Trash2 /> Vider le cache
          </Button>
        </Row>

        <p className="pt-4 text-xs text-muted-foreground">
          État voix : {phase}
          {grammarSize > 0 && ` — grammaire fermée de ${grammarSize} tokens`}. Un
          changement d'URL de modèle nécessite de désactiver puis réactiver la voix
          {phase === 'ready' && (
            <Button
              variant="link"
              size="sm"
              onClick={() => disableVoice()}
              className="h-auto p-0 pl-1 text-xs"
            >
              (désactiver)
            </Button>
          )}
          .
        </p>
      </CardContent>
    </Card>
  );
}
