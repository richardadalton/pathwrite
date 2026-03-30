<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { EmployeeDetails } from "../employee-details";
import TabBar from "./TabBar.vue";

const { snapshot, setData } = usePathContext<EmployeeDetails>();

const showErrors = computed(() => snapshot.value.hasAttemptedNext || snapshot.value.hasValidated);
const errors = computed(() => showErrors.value ? snapshot.value.fieldErrors : {});
</script>

<template>
  <div class="tab-content">
    <TabBar />
    <div class="form-body">
      <div class="row">
        <div class="field" :class="{ 'field--error': errors.firstName }">
          <label for="firstName">First Name <span class="required">*</span></label>
          <input
            id="firstName" type="text"
            :value="snapshot.data.firstName ?? ''"
            @input="setData('firstName', ($event.target as HTMLInputElement).value)"
            placeholder="Jane"
            autocomplete="given-name"
          />
          <span v-if="errors.firstName" class="field-error">{{ errors.firstName }}</span>
        </div>
        <div class="field" :class="{ 'field--error': errors.lastName }">
          <label for="lastName">Last Name <span class="required">*</span></label>
          <input
            id="lastName" type="text"
            :value="snapshot.data.lastName ?? ''"
            @input="setData('lastName', ($event.target as HTMLInputElement).value)"
            placeholder="Smith"
            autocomplete="family-name"
          />
          <span v-if="errors.lastName" class="field-error">{{ errors.lastName }}</span>
        </div>
      </div>

      <div class="field">
        <label for="dateOfBirth">Date of Birth <span class="optional">(optional)</span></label>
        <input
          id="dateOfBirth" type="date"
          :value="snapshot.data.dateOfBirth ?? ''"
          @input="setData('dateOfBirth', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="field">
        <label for="phone">Phone Number <span class="optional">(optional)</span></label>
        <input
          id="phone" type="tel"
          :value="snapshot.data.phone ?? ''"
          @input="setData('phone', ($event.target as HTMLInputElement).value)"
          placeholder="+353 86 123 4567"
          autocomplete="tel"
        />
      </div>

      <div class="field">
        <label for="personalEmail">Personal Email <span class="optional">(optional)</span></label>
        <input
          id="personalEmail" type="email"
          :value="snapshot.data.personalEmail ?? ''"
          @input="setData('personalEmail', ($event.target as HTMLInputElement).value)"
          placeholder="jane@personal.com"
          autocomplete="email"
        />
      </div>
    </div>
  </div>
</template>
