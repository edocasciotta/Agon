# Expert Review of the Repository

I want you to act as an independent Technical Review Board composed of experts who would realistically review a project like Agon.

Include experts such as:

* Senior Software Architect
* Open Source Maintainer
* Senior Backend Engineer (FastAPI/Python)
* Senior Frontend Engineer (React/Electron)
* Senior Mobile Engineer (React Native)
* DevOps & Infrastructure Engineer
* Security Engineer
* Database Engineer
* QA/Test Automation Lead
* UX Engineer (for desktop applications)
* Technical Writer / Documentation Lead
* Product Engineer focused on developer experience

Your goal is not to praise the project or confirm previous decisions. Your goal is to identify weaknesses, risks, inconsistencies, and opportunities for improvement.

Analyze the entire repository, including the codebase, folder structure, architecture, tests, documentation, configuration, CI/CD, and project organization.

For each expert:

1. Give an independent assessment from their own perspective.
2. Identify strengths.
3. Identify weaknesses.
4. Point out technical debt.
5. Highlight assumptions that may become problematic later.
6. Suggest concrete improvements, ordered by impact.

After every expert has spoken:

* Identify where experts agree.
* Identify where they disagree.
* Explain the trade-offs involved.
* State which opinion carries the strongest technical justification.

Then perform a cross-project review covering:

* Architecture consistency
* Scalability
* Maintainability
* Simplicity
* Security
* Developer Experience
* User Experience
* Test strategy
* Documentation quality
* Readiness for open-source contributors
* Readiness for V1 release
* Alignment with the Project Bible

Finally, produce:

Critical Issues

Problems that should be fixed before continuing development.

High-Value Improvements

Changes that would significantly improve the project but are not blockers.

Things Done Exceptionally Well

Decisions that should remain unchanged unless compelling evidence emerges.

Risk Assessment

Rate from 1–10:

* Architecture
* Code Quality
* Maintainability
* Security
* Documentation
* Test Coverage
* Contributor Friendliness
* Long-term Sustainability

Conclude with:

"If this repository were submitted as the foundation of a serious open-source project, would this review board approve it?"

The answer must be one of:

* Approve
* Approve with changes
* Major revision required

Justify the decision with evidence from the repository.

Be intellectually rigorous. Challenge assumptions. Distinguish facts from opinions. If you cannot evaluate something because information is missing, explicitly state that instead of making assumptions.
