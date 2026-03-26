import type { PathDefinition } from "@daltonr/pathwrite-core";
import type { SubscriptionData } from "./subscription.types";

export const subscriptionPath: PathDefinition<SubscriptionData> = {
  id: "subscription",
  steps: [
    {
      id: "select-plan",
      title: "Select Plan",
      fieldErrors: ({ data }) => ({
        plan: !(data.plan as string) ? "Please select a plan." : undefined,
      }),
    },
    {
      id: "shipping-address",
      title: "Shipping Address",
      fieldErrors: ({ data }) => ({
        shippingName:     !(data.shippingName as string)?.trim()     ? "Name is required."     : undefined,
        shippingAddress:  !(data.shippingAddress as string)?.trim()  ? "Address is required."  : undefined,
        shippingCity:     !(data.shippingCity as string)?.trim()      ? "City is required."     : undefined,
        shippingPostcode: !(data.shippingPostcode as string)?.trim() ? "Postcode is required." : undefined,
      }),
    },
    {
      id: "payment",
      title: "Payment Details",
      shouldSkip: ({ data }) => data.plan === "free",
      fieldErrors: ({ data }) => ({
        cardNumber: !(data.cardNumber as string)?.trim()  ? "Card number is required." : undefined,
        cardExpiry: !(data.cardExpiry as string)?.trim()   ? "Expiry date is required." : undefined,
        cardCvc:    !(data.cardCvc as string)?.trim()      ? "CVC is required."        : undefined,
      }),
    },
    {
      id: "billing-address",
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
      fieldErrors: ({ data }) => ({
        billingName:     !(data.billingName as string)?.trim()     ? "Name is required."     : undefined,
        billingAddress:  !(data.billingAddress as string)?.trim()  ? "Address is required."  : undefined,
        billingCity:     !(data.billingCity as string)?.trim()      ? "City is required."     : undefined,
        billingPostcode: !(data.billingPostcode as string)?.trim() ? "Postcode is required." : undefined,
      }),
    },
    {
      id: "review",
      title: "Review",
    },
  ],
};

