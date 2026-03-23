import type { PathDefinition } from "@daltonr/pathwrite-svelte";

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

// Step IDs use camelCase — Svelte component props cannot contain hyphens.
export const subscriptionPath: PathDefinition<SubscriptionData> = {
  id: "subscription",
  steps: [
    {
      id: "selectPlan",
      title: "Select Plan",
      fieldMessages: ({ data }) => ({
        plan: !data.plan ? "Please select a plan." : undefined,
      }),
    },
    {
      id: "shippingAddress",
      title: "Shipping Address",
      fieldMessages: ({ data }) => ({
        shippingName:     !data.shippingName?.trim()     ? "Name is required."     : undefined,
        shippingAddress:  !data.shippingAddress?.trim()  ? "Address is required."  : undefined,
        shippingCity:     !data.shippingCity?.trim()      ? "City is required."     : undefined,
        shippingPostcode: !data.shippingPostcode?.trim() ? "Postcode is required." : undefined,
      }),
    },
    {
      id: "payment",
      title: "Payment Details",
      shouldSkip: ({ data }) => data.plan === "free",
      fieldMessages: ({ data }) => ({
        cardNumber: !data.cardNumber?.trim()  ? "Card number is required." : undefined,
        cardExpiry: !data.cardExpiry?.trim()   ? "Expiry date is required." : undefined,
        cardCvc:    !data.cardCvc?.trim()      ? "CVC is required."        : undefined,
      }),
    },
    {
      id: "billingAddress",
      title: "Billing Address",
      shouldSkip: ({ data }) => data.plan === "free" || data.billingSameAsShipping === true,
      onEnter: ({ data, isFirstEntry }) => {
        if (isFirstEntry) {
          return {
            billingName:     data.billingName     || data.shippingName,
            billingAddress:  data.billingAddress  || data.shippingAddress,
            billingCity:     data.billingCity      || data.shippingCity,
            billingPostcode: data.billingPostcode || data.shippingPostcode,
          };
        }
      },
      fieldMessages: ({ data }) => ({
        billingName:     !data.billingName?.trim()     ? "Name is required."     : undefined,
        billingAddress:  !data.billingAddress?.trim()  ? "Address is required."  : undefined,
        billingCity:     !data.billingCity?.trim()      ? "City is required."     : undefined,
        billingPostcode: !data.billingPostcode?.trim() ? "Postcode is required." : undefined,
      }),
    },
    {
      id: "review",
      title: "Review",
    },
  ],
};

