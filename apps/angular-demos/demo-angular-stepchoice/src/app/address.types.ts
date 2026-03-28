export interface AddressData {
  // Step 1
  country: string;
  // US address
  streetAddress: string;
  aptUnit: string;
  city: string;
  state: string;
  zipCode: string;
  // Irish address
  addressLine1: string;
  addressLine2: string;
  town: string;
  county: string;
  eircode: string;
  [key: string]: unknown;
}

export const INITIAL_DATA: AddressData = {
  country: "",
  streetAddress: "", aptUnit: "", city: "", state: "", zipCode: "",
  addressLine1: "", addressLine2: "", town: "", county: "", eircode: "",
};

export const US_STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" },       { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },       { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },    { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },   { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },       { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },        { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },      { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },          { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },      { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },         { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" }, { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },     { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },      { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },      { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },    { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },{ code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },          { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },        { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },         { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },       { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },    { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },     { code: "WY", name: "Wyoming" },
];

export const IE_COUNTIES: string[] = [
  "Carlow", "Cavan", "Clare", "Cork", "Donegal", "Dublin",
  "Galway", "Kerry", "Kildare", "Kilkenny", "Laois", "Leitrim",
  "Limerick", "Longford", "Louth", "Mayo", "Meath", "Monaghan",
  "Offaly", "Roscommon", "Sligo", "Tipperary", "Waterford",
  "Westmeath", "Wexford", "Wicklow",
  "Antrim", "Armagh", "Down", "Fermanagh", "Londonderry", "Tyrone",
];
