'use client';

import type {
  CardExportEstimate,
  CardExportFilters,
  CardExportFormat,
  CardExportOptions,
  CardExportScope,
} from '@safir/shared-types';
import { Button, Checkbox, Dialog, Progress, RadioGroup } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { apiDownload, apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function AdminCardExportDialog({
  open,
  onOpenChange,
  filters,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: CardExportFilters;
}) {
  const [format, setFormat] = useState<CardExportFormat>('JSON');
  const [scope, setScope] = useState<CardExportScope>('FILTERED');
  const [includeArchived, setIncludeArchived] = useState(filters.archived !== 'active');
  const [includeTechnicalMetadata, setIncludeTechnicalMetadata] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const options = useMemo<CardExportOptions>(
    () => ({
      format,
      scope,
      includeArchived,
      includeTechnicalMetadata,
      ...(scope === 'FILTERED' ? { filters } : {}),
    }),
    [filters, format, includeArchived, includeTechnicalMetadata, scope],
  );
  const serializedOptions = JSON.stringify(options);
  const estimate = useQuery({
    queryKey: queryKeys.adminCardExportEstimate(serializedOptions),
    queryFn: () =>
      apiFetch<CardExportEstimate>('/api/v1/admin/cards/export/estimate', {
        method: 'POST',
        body: serializedOptions,
      }),
    enabled: open,
  });

  const startExport = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const download = await apiDownload('/api/v1/admin/cards/export', {
        method: 'POST',
        body: serializedOptions,
      });
      saveDownload(download.blob, download.fileName);
      onOpenChange(false);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "L'export a échoué.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!downloading) onOpenChange(nextOpen);
      }}
      title="Exporter les cartes"
      description="Le fichier est généré depuis toutes les cartes correspondant à la portée."
      footer={
        <>
          <Button variant="ghost" disabled={downloading} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            loading={downloading}
            disabled={estimate.isLoading || estimate.isError || !estimate.data?.count}
            onClick={() => void startExport()}
          >
            <Download className="size-4" />
            Exporter {estimate.data?.count ?? 0} carte{estimate.data?.count === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <FormatButton
            active={format === 'JSON'}
            icon={<FileJson className="size-5" />}
            label="JSON"
            onClick={() => setFormat('JSON')}
          />
          <FormatButton
            active={format === 'CSV'}
            icon={<FileSpreadsheet className="size-5" />}
            label="CSV"
            onClick={() => setFormat('CSV')}
          />
        </div>
        <RadioGroup
          label="Portée de l'export"
          value={scope}
          onValueChange={(value) => setScope(value as CardExportScope)}
          options={[
            { value: 'FILTERED', label: 'Filtres actuels' },
            { value: 'ALL', label: 'Toutes les cartes' },
          ]}
        />
        <div className="space-y-3">
          <Checkbox
            id="card-export-archived"
            checked={includeArchived}
            onCheckedChange={setIncludeArchived}
            label="Inclure les cartes archivées"
          />
          <Checkbox
            id="card-export-technical"
            checked={includeTechnicalMetadata}
            onCheckedChange={setIncludeTechnicalMetadata}
            label="Inclure les métadonnées techniques"
          />
        </div>
        {estimate.isLoading ? <Progress value={35} label="Estimation de l'export" /> : null}
        {estimate.data ? (
          <div className="flex items-baseline justify-between border-y border-border py-3">
            <span className="text-sm text-muted-foreground">Cartes à exporter</span>
            <strong className="text-xl">{estimate.data.count}</strong>
          </div>
        ) : null}
        {estimate.isError ? <InlineError message={estimate.error.message} /> : null}
        {downloadError ? <InlineError message={downloadError} /> : null}
        {downloading ? <Progress value={70} label="Génération du fichier" /> : null}
      </div>
    </Dialog>
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
      className={`flex min-h-20 items-center justify-center gap-2 rounded-md border p-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${active ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface hover:bg-surface-hover'}`}
    >
      {icon}
      {label}
    </button>
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

function saveDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
