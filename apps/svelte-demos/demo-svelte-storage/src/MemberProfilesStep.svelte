<script lang="ts">
  import { getPathContext } from "@daltonr/pathwrite-svelte";
  import { memberProfileSubPath } from "./wizard";
  import type { WizardData, Person, MemberProfile, ProfileSubData } from "./wizard";

  const ctx = getPathContext<WizardData>();

  let members  = $derived((ctx.snapshot?.data.members  ?? []) as Person[]);
  let profiles = $derived((ctx.snapshot?.data.profiles ?? {}) as Record<string, MemberProfile>);
  let errors   = $derived(ctx.snapshot?.hasAttemptedNext ? ctx.snapshot.fieldErrors : {});

  function getProfile(index: number): MemberProfile | null {
    return profiles[String(index)] ?? null;
  }

  let allDone = $derived(
    members.length > 0 &&
    members.every((_, i) => !!getProfile(i)?.department)
  );

  async function openProfile(member: Person, index: number) {
    const existing = getProfile(index);
    const initialData: ProfileSubData = {
      memberName:  member.name,
      memberRole:  member.role,
      memberIndex: index,
      department: existing?.department ?? "",
      startDate:  existing?.startDate  ?? "",
      bio:        existing?.bio        ?? "",
      goals30:    existing?.goals30    ?? "",
      goals90:    existing?.goals90    ?? "",
    };
    await ctx.startSubPath(memberProfileSubPath, initialData, { memberIndex: index });
  }
</script>

{#if ctx.snapshot}
  <div class="form-body">
    <p class="step-intro">
      Complete a profile for each team member. Click <strong>Fill in Profile</strong> to open a
      short two-step wizard, then return here when done. You can edit any profile before moving on.
    </p>

    <div class="profile-list">
      {#each members as member, i}
        <div class="profile-item" class:profile-item--done={!!getProfile(i)}>
          <span class="member-avatar">{member.name.charAt(0).toUpperCase()}</span>

          <div class="profile-item-info">
            <p class="profile-item-name">{member.name}</p>
            {#if member.role}<p class="profile-item-role">{member.role}</p>{/if}
          </div>

          {#if getProfile(i)}
            <div class="profile-done-meta">
              <span class="profile-done-dept">{getProfile(i)!.department}</span>
              <span class="profile-done-badge">✓ Done</span>
            </div>
            <button
              type="button"
              class="btn-edit"
              disabled={ctx.snapshot?.isNavigating}
              onclick={() => openProfile(member, i)}
            >Edit</button>
          {:else}
            <button
              type="button"
              class="btn-fill"
              disabled={ctx.snapshot?.isNavigating}
              onclick={() => openProfile(member, i)}
            >Fill in Profile →</button>
          {/if}
        </div>
      {/each}
    </div>

    {#if allDone}
      <p class="gate-done">✓ All {members.length} profiles complete — click Next to review.</p>
    {:else if errors._}
      <p class="gate-pending">⏳ {errors._}</p>
    {/if}
  </div>
{/if}
