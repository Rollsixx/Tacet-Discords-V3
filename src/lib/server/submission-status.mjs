const fallbackReason = "Submission did not meet review requirements.";

export function readPublicSubmissionState(status) {
  return status === "pending" || status === "approved" ? status : null;
}

export function publicRankReadiness(status, score) {
  return status === "approved" && score !== null && score !== undefined;
}

export function readRejectionReason(note) {
  const value = typeof note === "string" ? note.trim() : "";
  const match = value.match(/^[A-Z_]+:\s*([\s\S]*)$/);
  return (match?.[1] || value || fallbackReason).trim();
}
