import assert from "node:assert/strict";
import test from "node:test";

const helpers = await import("../src/utils/researchJobState.ts").catch(() => null);

function loadHelpers() {
  assert.ok(helpers, "researchJobState pure helper module should exist");
  return helpers;
}

test("maps backend 1/6 to planning", () => {
  const { stageForResearchJob } = loadHelpers();
  assert.equal(stageForResearchJob("running", "1/6"), "planning");
});

test("maps all retrieval stages to retrieving", () => {
  const { stageForResearchJob } = loadHelpers();
  for (const stage of ["2/6", "3/6", "4/6", "4b/6"]) {
    assert.equal(stageForResearchJob("running", stage), "retrieving");
  }
});

test("maps all judgement stages to judging", () => {
  const { stageForResearchJob } = loadHelpers();
  for (const stage of ["5/6", "5c/6", "5d/6", "6/6"]) {
    assert.equal(stageForResearchJob("running", stage), "judging");
  }
});

test("keeps the current stage conservative without known progress", () => {
  const { stageForResearchJob } = loadHelpers();
  assert.equal(stageForResearchJob("queued"), null);
  assert.equal(stageForResearchJob("running", null), null);
  assert.equal(stageForResearchJob("running", "unknown"), null);
  assert.equal(stageForResearchJob("running", "complete"), null);
});

test("only a done job maps to the done stage", () => {
  const { stageForResearchJob } = loadHelpers();
  assert.equal(stageForResearchJob("done"), "done");
  assert.equal(stageForResearchJob("done", "6/6"), "done");
  assert.equal(stageForResearchJob("failed", "6/6"), "judging");
});

test("queued and running jobs restore by polling", () => {
  const { recoveryActionForResearchJob } = loadHelpers();
  assert.equal(recoveryActionForResearchJob("queued"), "poll");
  assert.equal(recoveryActionForResearchJob("running"), "poll");
});

test("done jobs restore a report and failed jobs restore an error", () => {
  const { recoveryActionForResearchJob } = loadHelpers();
  assert.equal(recoveryActionForResearchJob("done"), "report");
  assert.equal(recoveryActionForResearchJob("failed"), "error");
});
