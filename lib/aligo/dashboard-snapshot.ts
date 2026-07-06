import { ALIGO_TEMPLATE_OPTIONS } from "@/lib/constants/aligo";
import type { AligoTemplateType } from "@/lib/constants/aligo";
import snapshotData from "./dashboard-snapshot.json";

export interface DashboardSnapshotEntry {
  templtCode?: string;
  templtName: string;
  placeholders?: string[];
  templtContent?: string;
}

export interface DashboardSnapshot {
  syncedAt: string | null;
  note?: string;
  templates: Partial<Record<AligoTemplateType, DashboardSnapshotEntry>>;
}

export const DASHBOARD_SNAPSHOT = snapshotData as DashboardSnapshot;

/** snapshot에 등록된 Aligo 대시보드 템플릿명 (env 미적용) */
export function getSnapshotTemplateName(
  templateType: AligoTemplateType
): string {
  return DASHBOARD_SNAPSHOT.templates[templateType]?.templtName ?? templateType;
}

export function getSnapshotEntry(
  templateType: AligoTemplateType
): DashboardSnapshotEntry | null {
  return DASHBOARD_SNAPSHOT.templates[templateType] ?? null;
}

export function getAllSnapshotTemplateNames(): Record<
  AligoTemplateType,
  string
> {
  return Object.fromEntries(
    ALIGO_TEMPLATE_OPTIONS.map((type) => [type, getSnapshotTemplateName(type)])
  ) as Record<AligoTemplateType, string>;
}
