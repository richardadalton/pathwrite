import { createMemo } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { PathSnapshot } from "@daltonr/pathwrite-core";
import type { AddressData } from "./address-path";
import { IE_COUNTIES } from "./address-path";

interface Props {
  snapshot: PathSnapshot;
}

export default function IrishAddressForm(props: Props) {
  const { setData } = usePathContext<AddressData>();
  const data = createMemo(() => props.snapshot.data as AddressData);
  const errors = createMemo(() => props.snapshot.fieldErrors ?? {});

  return (
    <div class="form-body">
      <p class="step-intro">Enter your Irish address.</p>

      <div class={`field${errors().addressLine1 ? " field--error" : ""}`}>
        <label for="addressLine1">
          Address Line 1 <span class="required">*</span>
        </label>
        <input
          id="addressLine1"
          type="text"
          value={data().addressLine1}
          onInput={(e) => setData({ addressLine1: e.currentTarget.value })}
          placeholder="12 O'Connell Street"
        />
        {errors().addressLine1 && (
          <span class="field-error">{errors().addressLine1}</span>
        )}
      </div>

      <div class="field">
        <label for="addressLine2">
          Address Line 2 <span class="optional">(optional)</span>
        </label>
        <input
          id="addressLine2"
          type="text"
          value={data().addressLine2}
          onInput={(e) => setData({ addressLine2: e.currentTarget.value })}
          placeholder="Apartment 3"
        />
      </div>

      <div class={`field${errors().town ? " field--error" : ""}`}>
        <label for="town">
          Town / City <span class="required">*</span>
        </label>
        <input
          id="town"
          type="text"
          value={data().town}
          onInput={(e) => setData({ town: e.currentTarget.value })}
          placeholder="Dublin"
        />
        {errors().town && <span class="field-error">{errors().town}</span>}
      </div>

      <div class={`field${errors().county ? " field--error" : ""}`}>
        <label for="county">
          County <span class="required">*</span>
        </label>
        <select
          id="county"
          value={data().county}
          onChange={(e) => setData({ county: e.currentTarget.value })}
        >
          <option value="">Select county…</option>
          {IE_COUNTIES.map((c) => (
            <option value={c}>{c}</option>
          ))}
        </select>
        {errors().county && <span class="field-error">{errors().county}</span>}
      </div>

      <div class="field">
        <label for="eircode">
          Eircode <span class="optional">(optional)</span>
        </label>
        <input
          id="eircode"
          type="text"
          value={data().eircode}
          onInput={(e) => setData({ eircode: e.currentTarget.value })}
          placeholder="D01 F5P2"
          maxLength={8}
        />
      </div>
    </div>
  );
}
