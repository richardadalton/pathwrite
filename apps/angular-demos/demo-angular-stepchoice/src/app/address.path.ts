import type { PathDefinition } from "@daltonr/pathwrite-core";
import type { AddressData } from "./address.types";

function isValidZip(zip: string) {
  return /^\d{5}(-\d{4})?$/.test(zip.trim());
}

export const addressPath: PathDefinition<AddressData> = {
  id: "address-form",
  steps: [
    {
      id: "country",
      title: "Country",
      fieldErrors: ({ data }) => ({
        country: !data.country ? "Please select your country." : undefined,
      }),
    },
    {
      id: "address",
      title: "Your Address",
      select: ({ data }) => data.country === "US" ? "address-us" : "address-ie",
      steps: [
        {
          id: "address-us",
          fieldErrors: ({ data }) => ({
            streetAddress: !data.streetAddress?.trim() ? "Street address is required." : undefined,
            city:          !data.city?.trim()          ? "City is required."           : undefined,
            state:         !data.state                 ? "Please select a state."      : undefined,
            zipCode:       !data.zipCode?.trim()       ? "ZIP code is required."
                         : !isValidZip(data.zipCode)   ? "Enter a valid ZIP code (e.g. 90210)." : undefined,
          }),
        },
        {
          id: "address-ie",
          fieldErrors: ({ data }) => ({
            addressLine1: !data.addressLine1?.trim() ? "Address line 1 is required."  : undefined,
            town:         !data.town?.trim()         ? "Town / City is required."     : undefined,
            county:       !data.county               ? "Please select a county."      : undefined,
          }),
        },
      ],
    },
    {
      id: "confirm",
      title: "Confirm",
    },
  ],
};
