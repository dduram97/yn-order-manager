import { resolveTrackDeliveryStatus } from "@/lib/delivery/display";
import {
  extractCurrentLocation,
  fetchSmartTrackerTracking,
  mapSmartTrackerToDeliveryStatus,
  mapTrackingHistory,
} from "@/lib/delivery/smart-tracker";
import type { createClient } from "@/lib/supabase/server";
import {
  insertDeliveryTrackingLog,
  updateOrderDeliveryStatus,
} from "@/lib/supabase/delivery";
import type { DeliveryStatus, DeliveryTrackItem } from "@/types/delivery";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface TrackOrderDeliveryRow {
  id: string;
  tracking_number: string;
  aligo_status: string;
  delivery_status?: DeliveryStatus | null;
  delivery_location?: string | null;
}

export async function trackOrderDelivery(
  supabase: ServerSupabaseClient,
  row: TrackOrderDeliveryRow
): Promise<DeliveryTrackItem> {
  const fallbackStatus = resolveTrackDeliveryStatus(
    row.aligo_status,
    row.delivery_status
  );

  if (!row.tracking_number?.trim()) {
    return {
      order_id: row.id,
      tracking_number: row.tracking_number || "-",
      delivery_status: fallbackStatus ?? "ready",
      location: row.delivery_location ?? null,
      history: [],
      query_success: false,
      query_message: "송장번호가 없습니다.",
    };
  }

  if (row.aligo_status !== "success") {
    return {
      order_id: row.id,
      tracking_number: row.tracking_number,
      delivery_status: fallbackStatus ?? "ready",
      location: row.delivery_location ?? null,
      history: [],
      query_success: false,
      query_message: "알림톡 발송 완료 후 배송조회가 가능합니다.",
    };
  }

  try {
    const trackerData = await fetchSmartTrackerTracking(row.tracking_number);

    console.log("[DeliveryAutoSync][trackOrderDelivery] SmartTracker raw", {
      order_id: row.id,
      tracking_number: row.tracking_number,
      complete: trackerData.complete,
      completeYN: trackerData.completeYN,
      lastStateDetail: trackerData.lastStateDetail ?? null,
      lastDetail: trackerData.lastDetail ?? null,
      trackingDetailsLast:
        trackerData.trackingDetails?.[trackerData.trackingDetails.length - 1] ??
        null,
      raw: trackerData,
    });

    if (trackerData.status === false) {
      return {
        order_id: row.id,
        tracking_number: row.tracking_number,
        delivery_status:
          (row.delivery_status as DeliveryStatus | null) ?? "ready",
        location: row.delivery_location ?? null,
        history: [],
        query_success: false,
        query_message: trackerData.msg ?? "배송 정보를 찾을 수 없습니다.",
      };
    }

    const deliveryStatus = mapSmartTrackerToDeliveryStatus(trackerData);
    const location = extractCurrentLocation(trackerData);
    const history = mapTrackingHistory(trackerData);

    console.log("[DeliveryAutoSync][trackOrderDelivery] SmartTracker mapped", {
      order_id: row.id,
      tracking_number: row.tracking_number,
      mapped_delivery_status: deliveryStatus,
    });

    const lastHistory = history[history.length - 1];
    const trackingTime = lastHistory?.timeString
      ? new Date(lastHistory.timeString).toISOString()
      : new Date().toISOString();

    const beforeStatus =
      (row.delivery_status as DeliveryStatus | null) ?? "ready";

    const { error: updateError } = await updateOrderDeliveryStatus(
      supabase,
      row.id,
      {
        delivery_status: deliveryStatus,
        delivery_location: location,
        delivery_updated_at: trackingTime,
      }
    );

    if (updateError) {
      console.error(
        "[trackOrderDelivery] delivery_status 저장 실패:",
        updateError.message
      );
    } else {
      console.log("[DeliveryAutoSync][trackOrderDelivery] DB update success", {
        order_id: row.id,
        before_delivery_status: beforeStatus,
        after_delivery_status: deliveryStatus,
      });
    }

    const { error: logError } = await insertDeliveryTrackingLog(supabase, {
      order_id: row.id,
      tracking_number: row.tracking_number,
      delivery_status: deliveryStatus,
      location,
      tracking_time: trackingTime,
      raw_response: trackerData,
    });

    if (logError) {
      console.error("[trackOrderDelivery] delivery log 저장 실패:", logError.message);
    }

    return {
      order_id: row.id,
      tracking_number: row.tracking_number,
      delivery_status: deliveryStatus,
      location,
      history,
      query_success: true,
    };
  } catch (trackError) {
    const message =
      trackError instanceof Error ? trackError.message : String(trackError);
    console.error(
      `[trackOrderDelivery] 조회 실패 (${row.tracking_number}):`,
      message
    );

    return {
      order_id: row.id,
      tracking_number: row.tracking_number,
      delivery_status:
        (row.delivery_status as DeliveryStatus | null) ?? "ready",
      location: row.delivery_location ?? null,
      history: [],
      query_success: false,
      query_message: message,
    };
  }
}
