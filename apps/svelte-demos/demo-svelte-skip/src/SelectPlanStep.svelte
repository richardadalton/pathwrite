<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import type { SubscriptionData } from "./subscription";

  const ctx = usePathContext<SubscriptionData>();
  let errors = $derived(ctx.snapshot?.hasAttemptedNext ? ctx.snapshot.fieldErrors : {});
</script>

{#if ctx.snapshot}
  {@const data = ctx.snapshot.data}
  <div class="form-body">
    <p class="step-intro">Choose the plan that's right for you. Free gets you started — upgrade anytime.</p>

    <div class="plan-options">
      <label class="plan-card" class:plan-card--selected={data.plan === 'free'}>
        <input type="radio" name="plan" value="free" checked={data.plan === 'free'} onchange={() => ctx.setData("plan", "free")} />
        <div class="plan-card__body">
          <span class="plan-card__name">Free</span>
          <span class="plan-card__price">$0 / month</span>
          <ul class="plan-card__features"><li>1 project</li><li>Community support</li><li>Basic analytics</li></ul>
        </div>
      </label>

      <label class="plan-card" class:plan-card--selected={data.plan === 'paid'}>
        <input type="radio" name="plan" value="paid" checked={data.plan === 'paid'} onchange={() => ctx.setData("plan", "paid")} />
        <div class="plan-card__body">
          <span class="plan-card__name">Pro</span>
          <span class="plan-card__price">$29 / month</span>
          <ul class="plan-card__features"><li>Unlimited projects</li><li>Priority support</li><li>Advanced analytics</li><li>Custom branding</li></ul>
        </div>
      </label>
    </div>

    {#if errors.plan}<span class="field-error">{errors.plan}</span>{/if}
    {#if data.plan === 'free'}<p class="plan-note">ℹ️ Free plan — payment and billing steps will be skipped.</p>{/if}
  </div>
{/if}

