export interface MainBranchCandidate {
  id: string;
  isMainBranch: boolean;
}

// Returns true if setting `editingId` (or a new branch, when editingId is null)
// as the main branch would leave the organisation with more than one.
export function wouldCreateDuplicateMainBranch(existing: MainBranchCandidate[], editingId: string | null): boolean {
  return existing.some((branch) => branch.isMainBranch && branch.id !== editingId);
}
