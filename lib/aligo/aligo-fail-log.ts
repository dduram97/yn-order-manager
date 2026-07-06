/** @deprecated ops-log.ts 사용 — 하위 호환 re-export */
export {
  logAligoFail,
  summarizeAligoPayload,
  mapTransportToFailKind as mapTransportKindToFailKind,
  type AligoFailKind,
  type AligoPayloadSummary as AligoFailPayloadSummary,
} from "./ops-log";
