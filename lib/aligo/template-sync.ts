import type { AligoTemplateType } from "@/lib/constants/aligo";
import { ALIGO_TEMPLATE_OPTIONS } from "@/lib/constants/aligo";
import { getTemplateCode } from "./template-schema";
import { fetchVpsTemplates } from "./vps-client";

export interface AligoTemplateButton {
  ordering: string;
  name: string;
  linkType: string;
  linkTypeName?: string;
  linkMo?: string;
  linkPc?: string;
  linkIos?: string;
  linkAnd?: string;
}

export interface AligoRemoteTemplate {
  templtCode: string;
  templtName: string;
  templtContent: string;
  templtTitle?: string;
  templtSubtitle?: string;
  templateEmType?: string;
  templateType?: string;
  buttons?: AligoTemplateButton[];
  inspStatus?: string;
  status?: string;
}

/** Aligo API는 CRLF 줄바꿈을 사용합니다. (검증·비교용 — 발송 message는 trim 하지 않음) */
export function normalizeTemplateContent(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

/** 발송용 message_1 — 승인 템플릿 CRLF 형식 통일 */
export function toAligoLineEndings(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, "\r\n");
}

/** VPS /api/aligo/templates — 실시간 조회 */
export async function fetchRemoteTemplates(): Promise<{
  templates: AligoRemoteTemplate[];
  message: string;
}> {
  const result = await fetchVpsTemplates();
  return { templates: result.templates, message: result.message };
}

export function findRemoteTemplateByCode(
  templates: AligoRemoteTemplate[],
  templtCode: string
): AligoRemoteTemplate | null {
  return templates.find((t) => t.templtCode === templtCode) ?? null;
}

/** templtCode 기준 매칭 (UI templateType → getTemplateCode) */
export function findRemoteTemplate(
  templates: AligoRemoteTemplate[],
  templateType: AligoTemplateType
): AligoRemoteTemplate | null {
  const templtCode = getTemplateCode(templateType);
  return findRemoteTemplateByCode(templates, templtCode);
}

export interface TemplateVerificationItem {
  templateType: AligoTemplateType;
  matched: boolean;
  templtCode?: string;
  templtName?: string;
  remoteContent?: string;
  localContent?: string;
  contentMatch?: boolean;
  syncRequired?: boolean;
  message: string;
}

export function verifyTemplatesAgainstLocal(
  remoteTemplates: AligoRemoteTemplate[],
  localTemplates: Record<AligoTemplateType, string>
): TemplateVerificationItem[] {
  return ALIGO_TEMPLATE_OPTIONS.map((templateType) => {
    const remote = findRemoteTemplate(remoteTemplates, templateType);
    const localContent = localTemplates[templateType];
    const expectedCode = getTemplateCode(templateType);

    if (!remote) {
      return {
        templateType,
        matched: false,
        localContent,
        message: `Aligo에서 templtCode '${expectedCode}' 템플릿을 찾지 못했습니다.`,
      };
    }

    const remoteNormalized = normalizeTemplateContent(remote.templtContent);
    const localNormalized = normalizeTemplateContent(localContent);

    if (!localNormalized) {
      return {
        templateType,
        matched: true,
        templtCode: remote.templtCode,
        templtName: remote.templtName,
        remoteContent: remote.templtContent,
        localContent,
        syncRequired: true,
        message:
          "로컬 fallback이 비어 있습니다. npm run aligo:sync-templates 로 동기화하세요.",
      };
    }

    const contentMatch = remoteNormalized === localNormalized;

    return {
      templateType,
      matched: true,
      templtCode: remote.templtCode,
      templtName: remote.templtName,
      remoteContent: remote.templtContent,
      localContent,
      contentMatch,
      message: contentMatch
        ? "대시보드 템플릿과 일치합니다."
        : "대시보드 템플릿과 불일치합니다. npm run aligo:sync-templates 로 수정하세요.",
    };
  });
}

export async function resolveRemoteTemplate(
  templateType: AligoTemplateType
): Promise<AligoRemoteTemplate> {
  const { templates } = await fetchRemoteTemplates();
  const templtCode = getTemplateCode(templateType);
  const found = findRemoteTemplateByCode(templates, templtCode);

  if (!found) {
    const available = templates.map((t) => t.templtCode).join(", ");
    throw new Error(
      `templtCode '${templtCode}' 템플릿을 Aligo에서 찾을 수 없습니다. 등록된 코드: ${available || "(없음)"}`
    );
  }

  if (found.inspStatus && found.inspStatus !== "APR") {
    console.warn(
      `[Aligo] templtCode '${found.templtCode}' 승인 상태: ${found.inspStatus}`
    );
  }

  return found;
}
