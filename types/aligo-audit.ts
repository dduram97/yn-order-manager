/** orders.aligo_response JSON 구조 */
export interface AligoResponseLog {
  success: boolean;
  templtCode?: string;
  templateType?: string;
  finalMessage?: string;
  subject?: string;
  requestPayload?: Record<string, unknown>;
  responseBody?: Record<string, unknown>;
  errorMessage?: string | null;
  aligoCode?: number;
  scnt?: number;
  fcnt?: number;
  recordedAt: string;
}
