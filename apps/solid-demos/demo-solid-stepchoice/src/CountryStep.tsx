import { createMemo } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { PathSnapshot } from "@daltonr/pathwrite-core";
import type { AddressData } from "./address-path";

interface Props {
  snapshot: PathSnapshot;
}

export default function CountryStep(props: Props) {
  const { setData } = usePathContext<AddressData>();
  const data = createMemo(() => props.snapshot.data as AddressData);
  const errors = createMemo(() => props.snapshot.fieldErrors ?? {});

  return (
    <div class="form-body">
      <p class="step-intro">
        Select your country. The next step will show the appropriate address form.
      </p>

      <div class="field">
        <label>Country <span class="required">*</span></label>
        <div class="radio-group">
          <label class="radio-option">
            <input
              type="radio"
              name="country"
              value="US"
              checked={data().country === "US"}
              onChange={() => setData({ country: "US" })}
            />
            <span class="radio-option-label">🇺🇸 United States</span>
          </label>
          <label class="radio-option">
            <input
              type="radio"
              name="country"
              value="IE"
              checked={data().country === "IE"}
              onChange={() => setData({ country: "IE" })}
            />
            <span class="radio-option-label">🇮🇪 Ireland</span>
          </label>
        </div>
        {errors().country && <span class="field-error">{errors().country}</span>}
      </div>

      <p class="hint">
        The <code>address</code> step uses <code>select</code> to choose between{" "}
        <code>address-us</code> and <code>address-ie</code> based on this selection.
      </p>
    </div>
  );
}
