import { usePathContext } from "@daltonr/pathwrite-react";
import type { EmployeeDetails } from "../employee-details";
import { TabBar } from "./TabBar";

export function PersonalTab() {
  const { snapshot, setData } = usePathContext<EmployeeDetails>();
  const data = snapshot.data;
  const showErrors = snapshot.hasAttemptedNext || snapshot.hasValidated;
  const errors = showErrors ? snapshot.fieldErrors : {};

  return (
    <div className="tab-content">
      <TabBar />
      <div className="form-body">
        <div className="row">
          <div className={`field ${errors.firstName ? "field--error" : ""}`}>
            <label htmlFor="firstName">First Name <span className="required">*</span></label>
            <input
              id="firstName" type="text"
              value={data.firstName ?? ""}
              onChange={e => setData("firstName", e.target.value)}
              placeholder="Jane"
              autoComplete="given-name"
            />
            {errors.firstName && <span className="field-error">{errors.firstName}</span>}
          </div>
          <div className={`field ${errors.lastName ? "field--error" : ""}`}>
            <label htmlFor="lastName">Last Name <span className="required">*</span></label>
            <input
              id="lastName" type="text"
              value={data.lastName ?? ""}
              onChange={e => setData("lastName", e.target.value)}
              placeholder="Smith"
              autoComplete="family-name"
            />
            {errors.lastName && <span className="field-error">{errors.lastName}</span>}
          </div>
        </div>

        <div className="field">
          <label htmlFor="dateOfBirth">Date of Birth <span className="optional">(optional)</span></label>
          <input
            id="dateOfBirth" type="date"
            value={data.dateOfBirth ?? ""}
            onChange={e => setData("dateOfBirth", e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="phone">Phone Number <span className="optional">(optional)</span></label>
          <input
            id="phone" type="tel"
            value={data.phone ?? ""}
            onChange={e => setData("phone", e.target.value)}
            placeholder="+353 86 123 4567"
            autoComplete="tel"
          />
        </div>

        <div className="field">
          <label htmlFor="personalEmail">Personal Email <span className="optional">(optional)</span></label>
          <input
            id="personalEmail" type="email"
            value={data.personalEmail ?? ""}
            onChange={e => setData("personalEmail", e.target.value)}
            placeholder="jane@personal.com"
            autoComplete="email"
          />
        </div>
      </div>
    </div>
  );
}
