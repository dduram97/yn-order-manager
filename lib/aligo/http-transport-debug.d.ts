export type HttpFailureKind =
  | "TIMEOUT"
  | "CONNECTION_REFUSED"
  | "HTTP_5XX"
  | "HTTP_4XX"
  | "HTTP_ERROR_WITH_RESPONSE"
  | "NO_RESPONSE"
  | "AXIOS_ERROR"
  | "GENERIC_ERROR"
  | "NON_ERROR_THROW"
  | "UNKNOWN";

export interface HttpFailureClassification {
  kind: HttpFailureKind | string;
  detail: string;
  code?: string | null;
  status?: number | null;
  name?: string;
}

export function logOutgoingHttpRequest(
  context: string,
  config: {
    method?: string;
    url: string;
    headers?: Record<string, unknown>;
    body?: unknown;
    bodyEncoding?: string;
  }
): void;

export function logIncomingHttpResponse(
  context: string,
  response: {
    status: number;
    statusText?: string;
    headers?: Record<string, unknown>;
    data?: unknown;
    rawBody?: string;
  }
): void;

export function dumpAxiosError(
  context: string,
  error: unknown
): HttpFailureClassification;

export function classifyHttpFailure(error: unknown): HttpFailureClassification;

export function logAligoFormFormatCheck(
  context: string,
  formPayload: Record<string, string | undefined>
): {
  missing: string[];
  buttonParseOk: boolean | null;
  buttonShape: Record<string, unknown> | null;
};

export function logHttpTransportFinalResult(
  context: string,
  input: {
    hop: string;
    success: boolean;
    classification?: HttpFailureClassification | null;
    httpStatus?: number | null;
    aligoCode?: number | null;
    aligoMessage?: string | null;
    note?: string;
  }
): void;

export function extractErrorMessage(error: unknown): string;
