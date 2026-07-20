'use client';

import type {
  CardImportExecutionResult,
  CardImportFormat,
  CardImportMode,
  CardImportPreview,
} from '@safir/shared-types';
import { Badge, Button, Checkbox, Dialog, Progress, RadioGroup } from '@safir/ui';
import { useMutation } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FileJson,
  FileSpreadsheet,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { apiDownload, apiFetch } from '@/lib/api-client';

type ConflictBehavior = 'ERROR' | 'SKIP';

export function AdminCardImportDialog({
  open,
  onOpenChange,
  canCreateRelations,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canCreateRelations: boolean;
  onImported: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [format, setFormat] = useState<CardImportFormat>('JSON');
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<CardImportMode>('CREATE_ONLY');
  const [conflictBehavior, setConflictBehavior] = useState<ConflictBehavior>('ERROR');
  const [createMissingRelations, setCreateMissingRelations] = useState(false);
  const [relationConsent, setRelationConsent] = useState(false);
  const [preview, setPreview] = useState<CardImportPreview | null>(null);
  const [result, setResult] = useState<CardImportExecutionResult | null>(null);
  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Sélectionnez un fichier.');
      const body = new FormData();
      body.set('file', file);
      body.set('format', format);
      body.set('mode', mode);
      body.set('conflictBehavior', conflictBehavior);
      body.set('createMissingRelations', String(createMissingRelations));
      return apiFetch<CardImportPreview>('/api/v1/admin/cards/import/preview', {
        method: 'POST',
        body,
      });
    },
    onSuccess: (data) => {
      setPreview(data);
      setStep(4);
    },
  });
  const executeMutation = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error('La prévisualisation est absente.');
      return apiFetch<CardImportExecutionResult>('/api/v1/admin/cards/import/execute', {
        method: 'POST',
        body: JSON.stringify({
          importPreviewId: preview.importPreviewId,
          fileHash: preview.fileHash,
        }),
      });
    },
    onSuccess: async (data) => {
      setResult(data);
      setStep(5);
      await onImported();
    },
  });
  const busy = previewMutation.isPending || executeMutation.isPending;

  const close = () => {
    if (busy) return;
    onOpenChange(false);
    window.setTimeout(reset, 150);
  };

  const reset = () => {
    setStep(1);
    setFormat('JSON');
    setFile(null);
    setMode('CREATE_ONLY');
    setConflictBehavior('ERROR');
    setCreateMissingRelations(false);
    setRelationConsent(false);
    setPreview(null);
    setResult(null);
    previewMutation.reset();
    executeMutation.reset();
  };

  const chooseFile = (nextFile: File | undefined) => {
    if (!nextFile) return;
    setFile(nextFile);
    setPreview(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) close();
      }}
      title={result ? 'Import terminé' : 'Importer des cartes'}
      description={
        result ? 'Les cartes et leurs relations ont été enregistrées.' : `Étape ${step} sur 5`
      }
      footer={
        result ? (
          <>
            <Button variant="ghost" onClick={() => downloadResult(result, 'CSV')}>
              <Download className="size-4" />
              Rapport CSV
            </Button>
            <Button onClick={close}>Voir les cartes importées</Button>
          </>
        ) : (
          <ImportFooter
            step={step}
            busy={busy}
            file={file}
            preview={preview}
            relationConsent={!createMissingRelations || relationConsent}
            onBack={() => setStep((current) => Math.max(1, current - 1))}
            onNext={() => setStep((current) => Math.min(3, current + 1))}
            onPreview={() => previewMutation.mutate()}
            onExecute={() => {
              setStep(5);
              executeMutation.mutate();
            }}
          />
        )
      }
    >
      {!result ? <StepIndicator step={step} /> : null}
      {step === 1 && !result ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormatButton
            active={format === 'JSON'}
            icon={<FileJson className="size-5" />}
            label="JSON"
            onClick={() => {
              setFormat('JSON');
              setFile(null);
            }}
          />
          <FormatButton
            active={format === 'CSV'}
            icon={<FileSpreadsheet className="size-5" />}
            label="CSV"
            onClick={() => {
              setFormat('CSV');
              setFile(null);
            }}
          />
        </div>
      ) : null}

      {step === 2 && !result ? (
        <div className="space-y-4">
          <div
            className="grid min-h-40 place-items-center rounded-md border border-dashed border-border-strong bg-surface-muted p-5 text-center focus-within:ring-2 focus-within:ring-focus-ring"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              chooseFile(event.dataTransfer.files[0]);
            }}
          >
            {file ? (
              <div className="min-w-0">
                <Check className="mx-auto size-6 text-success" />
                <p className="mt-2 truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                <Button className="mt-3" size="sm" variant="ghost" onClick={() => setFile(null)}>
                  <Trash2 className="size-4" />
                  Retirer
                </Button>
              </div>
            ) : (
              <div>
                <Upload className="mx-auto size-6 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">Déposer un fichier {format}</p>
                <Button className="mt-3" size="sm" onClick={() => inputRef.current?.click()}>
                  Sélectionner
                </Button>
              </div>
            )}
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept={format === 'JSON' ? '.json,application/json' : '.csv,text/csv'}
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => downloadTemplate('JSON')}>
              <Download className="size-4" />
              Modèle JSON
            </Button>
            <Button variant="secondary" size="sm" onClick={() => downloadTemplate('CSV')}>
              <Download className="size-4" />
              Modèle CSV
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 && !result ? (
        <div className="space-y-5">
          <RadioGroup
            label="Mode d'import"
            value={mode}
            onValueChange={(value) => setMode(value as CardImportMode)}
            options={[
              { value: 'CREATE_ONLY', label: 'Créer uniquement' },
              { value: 'UPSERT', label: 'Créer ou mettre à jour' },
              { value: 'UPDATE_ONLY', label: 'Mettre à jour uniquement' },
            ]}
          />
          <RadioGroup
            label="Conflits"
            value={conflictBehavior}
            onValueChange={(value) => setConflictBehavior(value as ConflictBehavior)}
            options={[
              { value: 'ERROR', label: 'Bloquer en cas de conflit' },
              { value: 'SKIP', label: 'Ignorer les cartes concernées' },
            ]}
          />
          <Checkbox
            id="card-import-atomic"
            checked
            disabled
            label="Import atomique"
            description="Une erreur annule toute l'opération."
          />
          {canCreateRelations ? (
            <Checkbox
              id="card-import-create-relations"
              checked={createMissingRelations}
              onCheckedChange={(checked) => {
                setCreateMissingRelations(checked);
                if (!checked) setRelationConsent(false);
              }}
              label="Créer les relations manquantes"
              description="Les raretés, saisons et types seront créés inactifs."
            />
          ) : null}
          {createMissingRelations ? (
            <div className="border-l-2 border-warning pl-3">
              <Checkbox
                id="card-import-relation-consent"
                checked={relationConsent}
                onCheckedChange={setRelationConsent}
                label="Je confirme la création des relations"
              />
            </div>
          ) : null}
          {previewMutation.isError ? <InlineError message={previewMutation.error.message} /> : null}
          {previewMutation.isPending ? <Progress value={45} label="Analyse du fichier" /> : null}
        </div>
      ) : null}

      {step === 4 && preview && !result ? (
        <PreviewReport preview={preview} onDownload={(type) => downloadPreview(preview, type)} />
      ) : null}

      {step === 5 && !result ? (
        <div className="space-y-5">
          {executeMutation.isPending ? <Progress value={85} label="Import transactionnel" /> : null}
          {executeMutation.isError ? <InlineError message={executeMutation.error.message} /> : null}
        </div>
      ) : null}

      {result ? <ExecutionReport result={result} /> : null}
    </Dialog>
  );
}

function ImportFooter({
  step,
  busy,
  file,
  preview,
  relationConsent,
  onBack,
  onNext,
  onPreview,
  onExecute,
}: {
  step: number;
  busy: boolean;
  file: File | null;
  preview: CardImportPreview | null;
  relationConsent: boolean;
  onBack: () => void;
  onNext: () => void;
  onPreview: () => void;
  onExecute: () => void;
}) {
  const importLabel = preview
    ? preview.summary.createCount && preview.summary.updateCount
      ? `Créer ${preview.summary.createCount} et modifier ${preview.summary.updateCount}`
      : preview.summary.updateCount
        ? `Modifier ${preview.summary.updateCount} carte${preview.summary.updateCount > 1 ? 's' : ''}`
        : `Importer ${preview.summary.createCount} carte${preview.summary.createCount > 1 ? 's' : ''}`
    : 'Confirmer';
  return (
    <>
      {step > 1 ? (
        <Button variant="ghost" disabled={busy} onClick={onBack}>
          <ArrowLeft className="size-4" />
          Retour
        </Button>
      ) : null}
      {step < 3 ? (
        <Button disabled={step === 2 && !file} onClick={onNext}>
          Continuer
          <ArrowRight className="size-4" />
        </Button>
      ) : null}
      {step === 3 ? (
        <Button loading={busy} disabled={!file || !relationConsent} onClick={onPreview}>
          Analyser le fichier
        </Button>
      ) : null}
      {step === 4 ? (
        <Button
          disabled={!preview?.canExecute || busy}
          onClick={() => {
            onExecute();
          }}
        >
          {importLabel}
        </Button>
      ) : null}
      {step === 5 ? (
        <Button loading={busy} disabled={busy} onClick={onExecute}>
          {busy ? 'Import en cours' : 'Réessayer'}
        </Button>
      ) : null}
    </>
  );
}

function StepIndicator({ step }: { step: number }) {
  return (
    <ol className="mb-5 grid grid-cols-5 gap-1" aria-label="Progression de l'import">
      {['Format', 'Fichier', 'Options', 'Aperçu', 'Import'].map((label, index) => (
        <li key={label} className="min-w-0">
          <span
            className={`block h-1 rounded-sm ${index + 1 <= step ? 'bg-primary' : 'bg-border'}`}
          />
          <span className="mt-1 block truncate text-center text-[11px] text-muted-foreground">
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function FormatButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-24 items-center justify-center gap-3 rounded-md border p-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${active ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface hover:bg-surface-hover'}`}
    >
      {icon}
      {label}
    </button>
  );
}

function PreviewReport({
  preview,
  onDownload,
}: {
  preview: CardImportPreview;
  onDownload: (format: CardImportFormat) => void;
}) {
  const stats = [
    ['Lignes', preview.summary.totalRows],
    ['Valides', preview.summary.validRows],
    ['Créations', preview.summary.createCount],
    ['Modifications', preview.summary.updateCount],
    ['Ignorées', preview.summary.skippedCount],
    ['Erreurs', preview.summary.errorCount],
  ] as const;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 border-y border-border sm:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label} className="p-3 text-center">
            <p className="text-xl font-semibold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      {preview.warnings.length ? (
        <div className="space-y-2 border-l-2 border-warning pl-3 text-sm">
          {preview.warnings.slice(0, 10).map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
      {preview.errors.length ? (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Erreurs détaillées</h3>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => onDownload('JSON')}>
                JSON
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDownload('CSV')}>
                CSV
              </Button>
            </div>
          </div>
          <ul className="max-h-60 divide-y divide-border overflow-y-auto border-y border-border">
            {preview.errors.slice(0, 100).map((error, index) => (
              <li key={`${error.row}-${error.field}-${index}`} className="py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">
                    Ligne {error.row} · {error.field}
                  </p>
                  <Badge tone="danger">{error.code}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">{error.message}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-success">
          <Check className="size-4" />
          Le fichier peut être importé.
        </div>
      )}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Cartes analysées</h3>
        <ul className="max-h-56 divide-y divide-border overflow-y-auto border-y border-border">
          {preview.rows.slice(0, 100).map((row) => (
            <li key={row.row} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                {row.row}. {row.name}
              </span>
              <Badge
                tone={
                  row.action === 'ERROR' ? 'danger' : row.action === 'SKIP' ? 'neutral' : 'success'
                }
              >
                {actionLabel(row.action)}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ExecutionReport({ result }: { result: CardImportExecutionResult }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-success">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success-soft">
          <Check className="size-5" />
        </span>
        <p className="font-semibold">Toutes les modifications ont été validées.</p>
      </div>
      <dl className="divide-y divide-border border-y border-border text-sm">
        <ResultLine label="Cartes analysées" value={result.summary.totalRows} />
        <ResultLine label="Cartes créées" value={result.summary.createCount} />
        <ResultLine label="Cartes mises à jour" value={result.summary.updateCount} />
        <ResultLine label="Cartes ignorées" value={result.summary.skippedCount} />
        <ResultLine label="Erreurs" value={result.summary.errorCount} />
      </dl>
    </div>
  );
}

function ResultLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div role="alert" className="flex gap-2 border-l-2 border-danger pl-3 text-sm text-danger">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}

function actionLabel(action: CardImportPreview['rows'][number]['action']): string {
  return { CREATE: 'Créer', UPDATE: 'Modifier', SKIP: 'Ignorer', ERROR: 'Erreur' }[action];
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} o`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} Ko`;
  return `${(bytes / 1_048_576).toFixed(1)} Mo`;
}

async function downloadTemplate(format: CardImportFormat): Promise<void> {
  const download = await apiDownload(`/api/v1/admin/cards/import/template/${format.toLowerCase()}`);
  saveDownload(download.blob, download.fileName);
}

function downloadPreview(preview: CardImportPreview, format: CardImportFormat): void {
  const content =
    format === 'JSON'
      ? `${JSON.stringify({ operationId: preview.importPreviewId, errors: preview.errors }, null, 2)}\n`
      : errorsCsv(preview.errors);
  saveDownload(
    new Blob([format === 'CSV' ? `\uFEFF${content}` : content], {
      type: format === 'JSON' ? 'application/json' : 'text/csv;charset=utf-8',
    }),
    `safir-card-import-errors.${format.toLowerCase()}`,
  );
}

function downloadResult(result: CardImportExecutionResult, format: CardImportFormat): void {
  const content =
    format === 'JSON'
      ? JSON.stringify(result, null, 2)
      : `metric;value\r\ntotalRows;${result.summary.totalRows}\r\ncreatedCount;${result.summary.createCount}\r\nupdatedCount;${result.summary.updateCount}\r\nskippedCount;${result.summary.skippedCount}\r\nerrorCount;${result.summary.errorCount}\r\n`;
  saveDownload(
    new Blob([content], { type: 'text/csv;charset=utf-8' }),
    'safir-card-import-report.csv',
  );
}

function errorsCsv(errors: CardImportPreview['errors']): string {
  const columns = ['row', 'cardName', 'field', 'value', 'code', 'message'];
  const rows = errors.map((error) =>
    [
      error.row,
      error.cardName ?? '',
      error.field,
      JSON.stringify(error.value ?? ''),
      error.code,
      error.message,
    ]
      .map(csvCell)
      .join(';'),
  );
  return `${columns.join(';')}\r\n${rows.join('\r\n')}\r\n`;
}

function csvCell(value: unknown): string {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function saveDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
