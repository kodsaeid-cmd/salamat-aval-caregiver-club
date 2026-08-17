# Training exam evaluation v1

- Every newly created training course requires an external exam URL.
- The caregiver sees an `ورود به آزمون` action beside the assigned training; the exam opens externally and does not silently mark the training complete.
- Training exam evaluation is recorded by authorized staff in the Evaluations module.
- Scores are integer values from 1 through 20.
- A result is valid for one calendar year from its exam date. The server computes `valid_until`; clients only display it.
- Results are append-only attempts. Retakes create new rows and preserve prior history.
- A result can only be recorded for a course that is actually assigned to the caregiver.
- Caregivers can read only their own results. Staff reads/entry use the existing `staff.evaluations` access contract.
- Results are visible in the admin caregiver dossier and in the caregiver scorecard under a dedicated exam-results tab.
- Migration 0125 is additive and does not rewrite historical training rows.
