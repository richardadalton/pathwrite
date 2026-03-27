import type { PathDefinition, FieldErrors } from "@daltonr/pathwrite-core";

export interface ContactData {
  name: string;
  email: string;
  subject: string;
  message: string;
  [key: string]: unknown;  // Required for PathData constraint
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
    fieldErrors: ({ data }) => {
      const m: FieldErrors = {};
      if (!data.name?.trim())                               m.name    = "Required.";
      if (!data.email?.trim())                              m.email   = "Required.";
      else if (!isValidEmail(data.email))                   m.email   = "Invalid email address.";
      if (!data.subject)                                    m.subject = "Please select a subject.";
      if ((data.message ?? "").trim().length < 10)          m.message = "Minimum 10 characters.";
      return m;
    },
    fieldWarnings: ({ data }) => {
      const w: FieldErrors = {};
      const email = data.email?.trim() ?? "";
      if (email && /@(gmial|gmali|gmal|gamil)\./i.test(email))
        w.email = "Did you mean gmail.com?";
      const msgLen = (data.message ?? "").trim().length;
      if (msgLen >= 10 && msgLen < 30)
        w.message = "Short messages may not get a detailed reply.";
      return w;
    }
  }]
};
