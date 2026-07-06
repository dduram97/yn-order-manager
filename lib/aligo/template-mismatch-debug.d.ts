export interface TemplateSubstitutionDetail {
  field: string;
  label: string;
  placeholder: string;
  rawValue: string | null | undefined;
  mappedValue: string;
  isNull: boolean;
  isEmpty: boolean;
  mappedIsEmpty: boolean;
}

export interface TemplateMismatchFieldIssue {
  field: string;
  label: string;
  placeholder: string;
  reason: string;
  rawValue?: string | null;
  mappedValue?: string;
}

export interface TemplateLineMismatch {
  line: number;
  expected: string;
  actual: string;
  expectedJson?: string;
  actualJson?: string;
}

export interface TemplateCharDiff {
  index: number;
  expectedChar: string;
  expectedCharCode: number | null;
  actualChar: string;
  actualCharCode: number | null;
  expectedSnippet: string;
  actualSnippet: string;
  lineNumber: number;
}

export interface LineEndingAnalysis {
  totalLength: number;
  crlfCount: number;
  loneCrCount: number;
  loneLfCount: number;
  endsWithCrlf: boolean;
  endsWithLf: boolean;
  endsWithCr: boolean;
  trailingWhitespace: number;
}

export interface PlaceholderMappingRow {
  placeholder: string;
  field: string | null;
  label: string;
  mappedValue: string | null;
  stillInSentMessage: boolean;
  status: string;
}

export interface ApiTemplateComparison {
  apiTempltContentRaw: string;
  sentMessageRaw: string;
  expectedFromApiSubstitution: string;
  apiPlaceholders: string[];
  sentRemainingPlaceholders: string[];
  placeholderMappingTable: PlaceholderMappingRow[];
  rawVsSentIdentical: boolean;
  matchesApiRawSubstitution: boolean;
  matchesApiNormalizedSubstitution: boolean;
  apiLineEndings: LineEndingAnalysis;
  sentLineEndings: LineEndingAnalysis;
  expectedLineEndings: LineEndingAnalysis;
  apiWhitespaceIssues: Array<Record<string, unknown>>;
  sentWhitespaceIssues: Array<Record<string, unknown>>;
  firstDiffApiExpectedVsSent: TemplateCharDiff | null;
  firstDiffRawVsSent: TemplateCharDiff | null;
  firstMismatchLine: number | null;
}

export interface ButtonsComparison {
  match: boolean;
  reason: string | null;
  templateCount: number;
  sentCount: number;
  expectedJson?: string;
  sentJson: string | null;
  templateButtons: Array<Record<string, string>>;
  sentButtons: Array<Record<string, string>>;
  fieldDiffs: Array<Record<string, unknown>>;
  jsonMatch?: boolean;
  firstJsonDiff?: TemplateCharDiff | null;
}

export interface ButtonStringifyAnalysis {
  beforeObject: { button: Array<Record<string, unknown>> };
  expectedStringify: string | null;
  afterStringify: string | null;
  stringifyMatch: boolean;
  stringifyDiff: TemplateCharDiff | null;
  nullUndefinedFields: Array<Record<string, unknown>>;
  rawApiNullUndefinedFields: Array<Record<string, unknown>>;
  linkTypeChecks: Array<{
    ordering: string;
    name: string;
    field: string;
    templateValue: unknown;
    sentValue: unknown;
    exactMatch: boolean;
  }>;
  linkTypeAllMatch: boolean;
  orderComparison: {
    apiSequence: Array<{ arrayIndex: number; ordering: string; name: string }>;
    sentSequence: Array<{ arrayIndex: number; ordering: string; name: string }>;
    orderingSequenceMatch: boolean;
    arrayIndexOrderMatch: boolean;
  };
}

export interface EmtitleComparison {
  match: boolean;
  reason: string | null;
  required: boolean;
  expected: string | null | undefined;
  actual: string | null;
  firstDiff: TemplateCharDiff | null;
}

export interface PayloadComparison {
  match: boolean;
  expectedJson: string;
  actualJson: string;
  firstDiff: TemplateCharDiff | null;
}

export interface RootCauseCheck {
  priority: number;
  code: string;
  summary: string;
}

export interface RootCauseResult {
  primary: RootCauseCheck | null;
  allChecks: RootCauseCheck[];
  note: string | null;
}

export type MismatchReasonCode =
  | "TEMPLATE_SCHEMA_VALIDATION_MISMATCH"
  | "MESSAGE_MISMATCH"
  | "TEMPLATE_CODE_MISMATCH"
  | "VARIABLE_MISMATCH";

export interface ButtonSchemaSlot {
  slotIndex: number;
  ordering: string;
  linkType: string;
  linkTypeNameRequired: boolean;
  nameRequired: boolean;
  orderingType: "string" | "number";
  allowedKeys: string[];
  linkRules: Record<string, "required" | "empty_ok">;
}

export interface ApprovedButtonSchemaDefinition {
  buttonCount: number;
  rootShape: { wrapperKey: string; itemType: string };
  slots: ButtonSchemaSlot[];
}

export interface SchemaViolation {
  code: string;
  detail?: string;
  slotIndex?: number;
  field?: string;
  expected?: unknown;
  actual?: unknown;
  firstDiff?: TemplateCharDiff | null;
  approvedLineEndings?: LineEndingAnalysis;
  sentLineEndings?: LineEndingAnalysis;
}

export interface ButtonSchemaValidation {
  valid: boolean;
  violations: SchemaViolation[];
  schema: ApprovedButtonSchemaDefinition;
}

export interface TemplateSchemaValidationAnalysis {
  sourceOfTruth: string;
  compareTarget: string;
  match: boolean;
  verdict: string;
  validations: {
    tpl_code: {
      match: boolean;
      approved: string;
      sent: string;
    };
    message_1: {
      match: boolean;
      templateStrict: boolean;
      approvedSubstituted: string;
      sent: string;
    };
    button_1: ButtonSchemaValidation;
  };
  approvedButtonSchema: ApprovedButtonSchemaDefinition;
  violations: SchemaViolation[];
  rsltMessage: string | null;
  schemaPassButRsltFailed: boolean;
  history: Record<string, unknown> | null;
}

export interface ConfirmedRootCauseResult {
  confirmedRootCause: MismatchReasonCode | null;
  evidence: string[];
  schemaViolations?: SchemaViolation[];
  schemaVerdict?: string;
}

export interface MismatchReasonResult {
  reason: MismatchReasonCode | null;
  detail: string;
}

export interface ApiTemplateDebugSnapshot {
  templtCode?: string;
  templtContent?: string;
  templtTitle?: string;
  templateEmType?: string;
  buttons?: unknown[];
}

export interface TemplateMismatchReport {
  context: string;
  templtCode?: string;
  match: boolean;
  originalTemplate: string;
  apiFreshTempltContent: string;
  apiTemplate?: ApiTemplateDebugSnapshot;
  apiTemplateListRaw?: ApiTemplateDebugSnapshot | null;
  cachedVsApiIdentical: boolean;
  cachedVsApiDiff: TemplateCharDiff | null;
  finalMessage: string;
  expectedMessage: string;
  messageMatchesExpected: boolean;
  apiComparison: ApiTemplateComparison;
  buttonsComparison?: ButtonsComparison;
  buttonStringifyAnalysis?: ButtonStringifyAnalysis;
  templateSchemaValidationAnalysis?: TemplateSchemaValidationAnalysis;
  emtitleComparison?: EmtitleComparison;
  expectedSendPayload?: Record<string, string | undefined>;
  actualSendPayload?: Record<string, string | undefined>;
  payloadComparison?: PayloadComparison;
  requiredPlaceholders: string[];
  requiredFields: Array<{
    placeholder: string;
    field: string | null;
    label: string;
  }>;
  passedVariables: Record<string, string | null | undefined>;
  mappedSubstitutions: Record<string, string>;
  missingVariables: TemplateMismatchFieldIssue[];
  extraVariables: string[];
  nullOrEmptyFields: TemplateMismatchFieldIssue[];
  unknownPlaceholders: string[];
  unmatchedPlaceholders: string[];
  substitutionDetails: TemplateSubstitutionDetail[];
  firstCharDiff: TemplateCharDiff | null;
  lineMismatches: TemplateLineMismatch[];
  issues: string[];
  rootCause?: RootCauseResult;
  confirmedRootCause?: ConfirmedRootCauseResult;
  mismatchReason?: MismatchReasonResult;
}

export interface AnalyzeTemplateMismatchInput {
  context?: string;
  templtCode?: string;
  originalTemplate?: string;
  apiFreshTempltContent?: string;
  apiTemplate?: ApiTemplateDebugSnapshot;
  apiTemplateListRaw?: ApiTemplateDebugSnapshot;
  finalMessage: string;
  sentButton?: string;
  sentEmtitle?: string;
  sentSubject?: string;
  aligoFormPayload?: Record<string, string | undefined>;
  variables?: Record<string, string | null | undefined>;
  mappedSubstitutions?: Record<string, string>;
  requiredPlaceholders?: string[];
}

export interface AligoTemplateListFetchLog {
  listMessage?: string;
  totalCount: number;
  matched?: ApiTemplateDebugSnapshot | null;
  availableCodes?: string[];
  allTemplates?: ApiTemplateDebugSnapshot[];
}

export interface SchemaValidationInput {
  templtCode?: string;
  sentTplCode?: string;
  approvedButtons?: unknown[];
  approvedTempltContent?: string;
  mappedSubstitutions?: Record<string, string>;
  sentMessage?: string;
  sentButton?: string | null;
  historyButton?: string | null;
  historyMessage?: string | null;
  historyTplCode?: string | null;
  rsltMessage?: string | null;
}

export interface ThreeWayDiffResult {
  templtCode: string | null;
  rsltMessage: string | null;
  schema: TemplateSchemaValidationAnalysis;
  validations: TemplateSchemaValidationAnalysis["validations"];
  approvedButtonSchema: ApprovedButtonSchemaDefinition;
  violations: SchemaViolation[];
  verdict: string;
  schemaPassButRsltFailed: boolean;
  evidence: string[];
  history: Record<string, unknown> | null;
}

export function analyzeTemplateMismatch(
  input: AnalyzeTemplateMismatchInput
): TemplateMismatchReport;

export function logTemplateMismatchDebug(
  context: string,
  report: TemplateMismatchReport,
  aligoFormPayload?: Record<string, string | undefined | null> | null
): void;

export function logAligoCompareDebug(
  context: string,
  report: TemplateMismatchReport,
  aligoFormPayload?: Record<string, string | undefined | null> | null
): ConfirmedRootCauseResult;

export function confirmRootCauseFromLogs(
  report: TemplateMismatchReport,
  deliveryDetail?: Record<string, unknown> | null
): ConfirmedRootCauseResult;

export function analyzeTemplateSchemaValidation(
  input: SchemaValidationInput,
  deliveryDetail?: Record<string, unknown> | null
): TemplateSchemaValidationAnalysis;

export function buildSchemaValidationInputFromReport(
  report: TemplateMismatchReport,
  deliveryDetail?: Record<string, unknown> | null
): SchemaValidationInput;

export function logTemplateSchemaValidationDump(
  context: string,
  schema: TemplateSchemaValidationAnalysis
): void;

export function extractApprovedButtonSchemaDefinition(
  approvedButtons: unknown[]
): ApprovedButtonSchemaDefinition;

export function validateSentButtonAgainstSchema(
  schema: ApprovedButtonSchemaDefinition,
  sentButtonRaw: string | null
): ButtonSchemaValidation;

export function collectSchemaValidationEvidence(
  report: TemplateMismatchReport,
  deliveryDetail?: Record<string, unknown> | null
): {
  hasMismatch: boolean;
  schemaPassButRsltFailed: boolean;
  evidence: string[];
  schema: TemplateSchemaValidationAnalysis;
};

export function buildThreeWayDiff(
  report: TemplateMismatchReport,
  deliveryDetail?: Record<string, unknown> | null
): ThreeWayDiffResult;

export function logThreeWayDiff(
  context: string,
  threeWay: ThreeWayDiffResult,
  confirmed: ConfirmedRootCauseResult
): void;

export function resolveMismatchReason(
  report: TemplateMismatchReport,
  options?: { sentTplCode?: string }
): MismatchReasonResult;

export function logAligoTemplateListFetch(
  context: string,
  fetchResult: AligoTemplateListFetchLog
): void;

export function compareApiTemplateToSentMessage(
  apiTempltContent: string,
  sentMessage: string,
  mappedSubstitutions: Record<string, string>
): ApiTemplateComparison;

export function extractPlaceholders(content: string): string[];

export function buildExpectedMessage(
  originalTemplate: string,
  mappedSubstitutions: Record<string, string>
): string;

export function analyzeLineEndings(text: string): LineEndingAnalysis;
