import { ShipmentDetailForm } from "@/components/orders/shipment-detail-form";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ShipmentDetailForm orderId={id} />;
}
