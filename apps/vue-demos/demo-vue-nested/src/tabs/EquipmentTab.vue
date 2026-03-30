<script setup lang="ts">
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { EmployeeDetails } from "../employee-details";
import { LAPTOP_TYPES } from "../employee-details";
import TabBar from "./TabBar.vue";

const { snapshot, setData } = usePathContext<EmployeeDetails>();
</script>

<template>
  <div class="tab-content">
    <TabBar />
    <div class="form-body">
      <div class="field">
        <label for="laptopType">Laptop <span class="optional">(optional)</span></label>
        <select
          id="laptopType"
          :value="snapshot.data.laptopType ?? 'macbook-pro'"
          @change="setData('laptopType', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="l in LAPTOP_TYPES" :key="l.value" :value="l.value">{{ l.label }}</option>
        </select>
      </div>

      <div class="field">
        <label>Mobile Phone</label>
        <div class="radio-group">
          <label v-for="val in ['yes', 'no']" :key="val" class="radio-option">
            <input
              type="radio"
              name="needsPhone"
              :value="val"
              :checked="(snapshot.data.needsPhone ?? 'no') === val"
              @change="setData('needsPhone', val)"
            />
            <span class="radio-option-label">{{ val === 'yes' ? 'Provide a company phone' : 'No phone needed' }}</span>
          </label>
        </div>
      </div>

      <div class="field">
        <label>Access Card</label>
        <div class="radio-group">
          <label v-for="val in ['yes', 'no']" :key="val" class="radio-option">
            <input
              type="radio"
              name="needsAccessCard"
              :value="val"
              :checked="(snapshot.data.needsAccessCard ?? 'yes') === val"
              @change="setData('needsAccessCard', val)"
            />
            <span class="radio-option-label">{{ val === 'yes' ? 'Issue an access card' : 'No access card' }}</span>
          </label>
        </div>
      </div>

      <div class="field">
        <label for="otherEquipment">Other Equipment <span class="optional">(optional)</span></label>
        <input
          id="otherEquipment" type="text"
          :value="snapshot.data.otherEquipment ?? ''"
          @input="setData('otherEquipment', ($event.target as HTMLInputElement).value)"
          placeholder="e.g. standing desk, external monitor…"
        />
      </div>
    </div>
  </div>
</template>
