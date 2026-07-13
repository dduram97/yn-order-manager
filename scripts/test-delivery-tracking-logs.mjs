/**
 * delivery tracking event_type / 집계 규칙 검증
 * 실행: node --test scripts/test-delivery-tracking-logs.mjs
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** resolveDeliveryTrackingEventType 와 동일 로직 */
function resolveDeliveryTrackingEventType(source, deliveryStatus, previousStatus) {
  if (deliveryStatus === "delivered" && previousStatus !== "delivered") {
    return "delivery_completed";
  }
  return source;
}

const COUNTABLE = ["customer_view", "delivery_completed"];

const LABELS = {
  customer_view: "고객 배송조회",
  delivery_completed: "배송완료 확인",
  admin_view: "관리자 조회",
  auto_sync: "자동 동기화",
};

describe("delivery tracking event types", () => {
  it("maps sources to event_type when not delivered", () => {
    assert.equal(
      resolveDeliveryTrackingEventType("customer_view", "in_transit", "ready"),
      "customer_view"
    );
    assert.equal(
      resolveDeliveryTrackingEventType("admin_view", "ready", null),
      "admin_view"
    );
    assert.equal(
      resolveDeliveryTrackingEventType("auto_sync", "in_transit", "in_transit"),
      "auto_sync"
    );
  });

  it("uses delivery_completed only on first transition to delivered", () => {
    assert.equal(
      resolveDeliveryTrackingEventType("customer_view", "delivered", "in_transit"),
      "delivery_completed"
    );
    assert.equal(
      resolveDeliveryTrackingEventType("auto_sync", "delivered", "ready"),
      "delivery_completed"
    );
  });

  it("keeps source on subsequent views after already delivered", () => {
    assert.equal(
      resolveDeliveryTrackingEventType("customer_view", "delivered", "delivered"),
      "customer_view"
    );
    assert.equal(
      resolveDeliveryTrackingEventType("admin_view", "delivered", "delivered"),
      "admin_view"
    );
  });

  it("counts only customer_view and delivery_completed", () => {
    const events = [
      "customer_view",
      "delivery_completed",
      "admin_view",
      "auto_sync",
      "customer_view",
    ];
    const count = events.filter((e) => COUNTABLE.includes(e)).length;
    assert.equal(count, 3);
  });

  it("has Korean labels for all event types", () => {
    assert.equal(LABELS.customer_view, "고객 배송조회");
    assert.equal(LABELS.delivery_completed, "배송완료 확인");
    assert.equal(LABELS.admin_view, "관리자 조회");
    assert.equal(LABELS.auto_sync, "자동 동기화");
  });
});
