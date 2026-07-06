export interface RawCompareEvidenceItem {
  section?: string;
  check: string;
  [key: string]: unknown;
}

export interface RawCompareSectionResult {
  match: boolean;
  mismatchFields: string[];
  evidence: Array<Record<string, unknown>>;
}

export interface AligoRawCompareResult {
  match: boolean;
  mismatch_fields: string[];
  root_cause: "BUTTON_MISMATCH" | "MESSAGE_MISMATCH" | "VARIABLE_MISMATCH" | "UNKNOWN";
  evidence: RawCompareEvidenceItem[];
  comparisons: {
    buttons: RawCompareSectionResult & {
      apiJson: string | null;
      sentJson: string | null;
    };
    message: RawCompareSectionResult & {
      expectedMessage: string;
      rawTempltContent: string;
    };
    fullPayload: RawCompareSectionResult & {
      approved: Record<string, string>;
      sent: Record<string, string>;
      approvedJson: string;
      sentJson: string;
    };
    buttonPipeline: Record<string, unknown>;
  };
}

export interface AligoRawCompareInput {
  apiTemplate?: {
    templtCode?: string;
    templtContent?: string;
    buttons?: unknown[];
  } | null;
  tplCode: string;
  message1: string;
  button1?: string | null;
  mappedSubstitutions?: Record<string, string>;
  aligoFormPayload?: Record<string, unknown>;
  variables?: {
    missing?: unknown[];
    nullOrEmpty?: unknown[];
  };
}

export function runAligoRawTemplateCompareDebug(
  input: AligoRawCompareInput
): AligoRawCompareResult;
