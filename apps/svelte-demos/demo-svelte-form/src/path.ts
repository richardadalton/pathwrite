import type { PathDefinition, FieldErrors } from "@daltonr/pathwrite-svelte";

export interface ContactData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

function isValidEmail(value: string): boolean {
  return value.includes("@") && value.includes(".");
}

export const contactFormPath: PathDefinition<ContactData> = {
  id: "contact-form",
  steps: [{
    id: "contact",
    title: "Contact Us",
    onEnter: ({ isFirstEntry }) =>
      isFirstEntry ? { name: "", email: "", subject: "", message: "" } : undefined,
    fieldMessages: ({ data }) => {
      const m: FieldErrors = {};
      if (!data.name?.trim())                               m.name    = "Required.";
      if (!data.email?.trim())                              m.email   = "Required.";
      else if (!isValidEmail(data.email))                   m.email   = "Invalid email address.";
      if (!data.subject)                                    m.subject = "Please select a subject.";
      if ((data.message ?? "").trim().length < 10)          m.message = "Minimum 10 characters.";
      return m;
    }
  }]
};
