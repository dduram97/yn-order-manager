import axios from "axios";
import type { AligoCredentials, AligoEnv } from "./env";

const ALIGO_KAKAO_BASE_URL = "https://kakaoapi.aligo.in";

export interface AligoApiResponse {
  code: number;
  message: string;
  info?: {
    type?: string;
    mid?: string | number;
    current?: number;
    unit?: number;
    total?: number;
    scnt?: number;
    fcnt?: number;
  };
}

export async function postAligoForm(
  path: string,
  payload: Record<string, string>
): Promise<AligoApiResponse> {
  const response = await axios.post<AligoApiResponse>(
    `${ALIGO_KAKAO_BASE_URL}${path}`,
    new URLSearchParams(payload).toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 15000,
    }
  );

  return response.data;
}

export function buildAligoAuthPayload(
  env: AligoCredentials
): Record<string, string> {
  return {
    apikey: env.apiKey,
    userid: env.userId,
    senderkey: env.senderKey,
  };
}
