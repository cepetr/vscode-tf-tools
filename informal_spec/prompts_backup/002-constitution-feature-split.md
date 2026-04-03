/speckit.constitution

Amend the constitution’s Delivery Workflow so Speckit must read the relevant documents in informal_spec before spec, plan, tasks, and implementation, and must keep generated artifacts aligned to the selected slice.
Update the four agent files so they explicitly load user-spec.md, tech-spec.md, and feature-split.md before proceeding.
Add a narrow validation rule: each generated spec/plan/tasks set must state which informal-spec slice it implements and must reject cross-slice scope creep.