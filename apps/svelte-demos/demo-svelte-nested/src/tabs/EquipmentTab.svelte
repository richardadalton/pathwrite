<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import type { EmployeeDetails } from "../employee-details";
  import { LAPTOP_TYPES } from "../employee-details";
  import TabBar from "./TabBar.svelte";

  const ctx = usePathContext<EmployeeDetails, { showValidation: boolean }>();
</script>

<div class="tab-content">
  <TabBar />
  <div class="form-body">
    <div class="field">
      <label for="laptopType">Laptop <span class="optional">(optional)</span></label>
      <select
        id="laptopType"
        value={ctx.snapshot.data.laptopType ?? "macbook-pro"}
        onchange={(e) => ctx.setData("laptopType", e.currentTarget.value)}
      >
        {#each LAPTOP_TYPES as laptop (laptop.value)}
          <option value={laptop.value}>{laptop.label}</option>
        {/each}
      </select>
    </div>

    <div class="field">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label>Mobile Phone</label>
      <div class="radio-group">
        {#each ["yes", "no"] as val (val)}
          <label class="radio-option">
            <input
              type="radio"
              name="needsPhone"
              value={val}
              checked={(ctx.snapshot.data.needsPhone ?? "no") === val}
              onchange={() => ctx.setData("needsPhone", val)}
            />
            <span class="radio-option-label">
              {val === "yes" ? "Provide a company phone" : "No phone needed"}
            </span>
          </label>
        {/each}
      </div>
    </div>

    <div class="field">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label>Access Card</label>
      <div class="radio-group">
        {#each ["yes", "no"] as val (val)}
          <label class="radio-option">
            <input
              type="radio"
              name="needsAccessCard"
              value={val}
              checked={(ctx.snapshot.data.needsAccessCard ?? "yes") === val}
              onchange={() => ctx.setData("needsAccessCard", val)}
            />
            <span class="radio-option-label">
              {val === "yes" ? "Issue an access card" : "No access card"}
            </span>
          </label>
        {/each}
      </div>
    </div>

    <div class="field">
      <label for="otherEquipment">Other Equipment <span class="optional">(optional)</span></label>
      <input
        id="otherEquipment"
        type="text"
        value={ctx.snapshot.data.otherEquipment ?? ""}
        oninput={(e) => ctx.setData("otherEquipment", e.currentTarget.value)}
        placeholder="e.g. standing desk, external monitor…"
      />
    </div>
  </div>
</div>
