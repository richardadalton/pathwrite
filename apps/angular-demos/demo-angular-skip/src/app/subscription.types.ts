export interface SubscriptionData {
  plan: "free" | "paid" | "";
  shippingName: string;
  shippingAddress: string;
  shippingCity: string;
  shippingPostcode: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
  billingSameAsShipping: boolean;
  billingName: string;
  billingAddress: string;
  billingCity: string;
  billingPostcode: string;
  [key: string]: unknown;
}

export const INITIAL_DATA: SubscriptionData = {
  plan: "",
  shippingName: "", shippingAddress: "", shippingCity: "", shippingPostcode: "",
  cardNumber: "", cardExpiry: "", cardCvc: "",
  billingSameAsShipping: true,
  billingName: "", billingAddress: "", billingCity: "", billingPostcode: "",
};

export const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  paid: "Pro — $29/mo",
};

