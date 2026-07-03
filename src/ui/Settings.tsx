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
import { DEFAULT_MODEL_URL, keyCodeLabel, useSettingsStore } from '@/ui/state/settingsStore';
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
          label="URL du modèle vosk"
          hint="Fichier .tar.gz servi depuis public/model/ — voir README"
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
