import type { PathDefinition } from "@daltonr/pathwrite-core";

export interface ContactData {
  name: string;
  email: string;
  subject: string;
  message: string;
  [key: string]: unknown;
}

export const contactPath: PathDefinition<ContactData> = {
  id: "contact-form",
  steps: [
    {
      id: "contact",
      title: "Contact Us",
      fieldErrors: ({ data }) => ({
        name:    !data.name?.trim()    ? "Name is required." : undefined,
        email:   !data.email?.trim()   ? "Email is required."
               : !(data.email.includes("@") && data.email.includes("."))
                 ? "Enter a valid email address." : undefined,
        subject: !data.subject?.trim() ? "Subject is required." : undefined,
        message: (data.message?.trim()?.length ?? 0) < 10
                 ? "Message must be at least 10 characters." : undefined,
      }),
      fieldWarnings: ({ data }) => ({
        email: data.email?.includes("@gmail.") || data.email?.includes("@yahoo.")
               ? "Note: for business inquiries, a work email is preferred."
               : undefined,
        message: (data.message?.trim()?.length ?? 0) > 0 &&
                 (data.message?.trim()?.length ?? 0) < 50
                 ? "Short messages may not receive detailed responses."
                 : undefined,
      }),
    },
  ],
};

export const INITIAL_DATA: ContactData = { name: "", email: "", subject: "", message: "" };
