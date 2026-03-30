import type { PathData, PathDefinition } from "@daltonr/pathwrite-core";

export interface Person { name: string; role: string; }
export interface MemberProfile { department: string; startDate: string; bio: string; goals30: string; goals90: string; }
export interface WizardData extends PathData { teamName: string; members: Person[]; profiles: Record<string, MemberProfile>; }
export interface ProfileSubData extends PathData { memberName: string; memberRole: string; memberIndex: number; department: string; startDate: string; bio: string; goals30: string; goals90: string; }

export const INITIAL_DATA: WizardData = { teamName: "", members: [], profiles: {} };

export const memberProfileSubPath: PathDefinition<ProfileSubData> = {
  id: "memberProfile",
  steps: [
    { id: "background", title: "Background", fieldErrors: ({ data }) => ({
      department: !data.department?.toString().trim() ? "Department is required." : undefined,
      startDate: !data.startDate?.toString().trim() ? "Start date is required." : undefined,
      bio: !data.bio?.toString().trim() ? "A short bio is required." : undefined,
    })},
    { id: "goals", title: "Goals", fieldErrors: ({ data }) => ({
      goals30: !data.goals30?.toString().trim() ? "30-day goals are required." : undefined,
      goals90: !data.goals90?.toString().trim() ? "90-day goals are required." : undefined,
    })},
  ],
};

export const teamOnboardingPath: PathDefinition<WizardData> = {
  id: "teamOnboarding",
  steps: [
    { id: "teamSetup", title: "Team Setup", fieldErrors: ({ data }) => {
      const members = (data.members ?? []) as Person[];
      return {
        teamName: !data.teamName?.toString().trim() ? "Team name is required." : undefined,
        members: members.length === 0 ? "Add at least one team member."
          : members.some(m => !m.name?.toString().trim()) ? "All members need a name." : undefined,
      };
    }},
    { id: "memberProfiles", title: "Member Profiles", fieldErrors: ({ data }) => {
      const members = (data.members ?? []) as Person[];
      const profiles = (data.profiles ?? {}) as Record<string, MemberProfile>;
      const pending = members.filter((_, i) => !profiles[String(i)]?.department);
      return { _: pending.length > 0 ? `${pending.length} profile${pending.length !== 1 ? "s" : ""} still need to be completed.` : undefined };
    }, onSubPathComplete(_subPathId, subPathData, ctx, meta) {
      const idx = String(meta?.memberIndex as number);
      const existing = (ctx.data.profiles ?? {}) as Record<string, MemberProfile>;
      return { profiles: { ...existing, [idx]: { department: subPathData.department as string ?? "", startDate: subPathData.startDate as string ?? "", bio: subPathData.bio as string ?? "", goals30: subPathData.goals30 as string ?? "", goals90: subPathData.goals90 as string ?? "" } } };
    }},
    { id: "summary", title: "Summary" },
  ],
};
