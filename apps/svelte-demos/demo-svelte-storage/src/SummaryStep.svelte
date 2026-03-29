<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import type { WizardData, Person, MemberProfile } from "./wizard";

  const ctx = usePathContext<WizardData>();

  let members  = $derived((ctx.snapshot?.data.members  ?? []) as Person[]);
  let profiles = $derived((ctx.snapshot?.data.profiles ?? {}) as Record<string, MemberProfile>);

  function getProfile(index: number): MemberProfile | null {
    return profiles[String(index)] ?? null;
  }

  function formatDate(d: string): string {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-IE", {
        year: "numeric", month: "long", day: "numeric",
      });
    } catch {
      return d;
    }
  }
</script>

{#if ctx.snapshot}
  {@const d = ctx.snapshot.data}
  <div class="form-body">
    <p class="step-intro">
      Review everything before submitting. Click <strong>Previous</strong> to go back and make changes.
    </p>

    <!-- Team header -->
    <div class="summary-team-card">
      <span class="summary-team-icon">🏢</span>
      <div>
        <p class="summary-team-name">{d.teamName}</p>
        <p class="summary-team-meta">
          {members.length} member{members.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>

    <!-- Per-member cards -->
    {#each members as member, i}
      <div class="summary-member-card">
        <div class="summary-member-header">
          <span class="member-avatar member-avatar--lg">{member.name.charAt(0).toUpperCase()}</span>
          <div>
            <p class="summary-member-name">{member.name}</p>
            {#if member.role}<p class="summary-member-role">{member.role}</p>{/if}
          </div>
        </div>

        {#if getProfile(i)}
          <div class="summary-detail-grid">
            <span class="summary-key">Department</span>
            <span>{getProfile(i)!.department}</span>
            <span class="summary-key">Start Date</span>
            <span>{formatDate(getProfile(i)!.startDate)}</span>
          </div>

          <div class="summary-longtext-block">
            <p class="summary-longtext-label">Bio</p>
            <p class="summary-longtext-body">{getProfile(i)!.bio}</p>
          </div>

          <div class="summary-goals-grid">
            <div class="summary-goal-block">
              <p class="summary-goal-label">30-Day Goals</p>
              <p class="summary-longtext-body">{getProfile(i)!.goals30}</p>
            </div>
            <div class="summary-goal-block">
              <p class="summary-goal-label">90-Day Goals</p>
              <p class="summary-longtext-body">{getProfile(i)!.goals90}</p>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}
