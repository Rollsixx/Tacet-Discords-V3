import test from "node:test";
import assert from "node:assert/strict";
import {readPublicSubmissionState,readRejectionReason,publicRankReadiness} from "./submission-status.mjs";

test("public status lookup only exposes pending or approved submissions",()=>{
  assert.equal(readPublicSubmissionState("pending"),"pending");
  assert.equal(readPublicSubmissionState("approved"),"approved");
  assert.equal(readPublicSubmissionState("deleted"),null);
  assert.equal(readPublicSubmissionState("moderator-only"),null);
});

test("approved submission status distinguishes rank-ready and unranked builds",()=>{
  assert.equal(publicRankReadiness("approved",123),true);
  assert.equal(publicRankReadiness("approved",null),false);
  assert.equal(publicRankReadiness("pending",123),false);
});

test("rejection status contains the reviewer message without the internal reason code",()=>{
  assert.equal(readRejectionReason("MISMATCH: Echo stats did not match the screenshot."),"Echo stats did not match the screenshot.");
  assert.equal(readRejectionReason(""),"Submission did not meet review requirements.");
});
