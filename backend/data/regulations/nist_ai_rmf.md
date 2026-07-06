jurisdiction: US
regulation: NIST AI Risk Management Framework 1.0
topic: bias, governance, measurement, fairness
---

## GOVERN 1.1 — Legal and Regulatory Requirements

Legal and regulatory requirements involving AI are understood, managed, and documented. Organizations should ensure legal counsel and compliance officers are engaged early in the AI lifecycle to review data collection practices, downstream deployment contexts, and known risks of discrimination under Title VII of the Civil Rights Act, the Fair Housing Act, the Equal Credit Opportunity Act, and state-level anti-discrimination statutes. Audit findings that reveal disparate treatment across protected classes are direct evidence of legal exposure and must trigger a documented remediation plan.

## GOVERN 3.2 — Diverse Teams and Perspectives

Policies and procedures are in place to define and differentiate roles and responsibilities for human-AI configurations and oversight of AI systems. Organizations should require that development, testing, and oversight of AI systems include participation of individuals with diverse demographic backgrounds and lived experiences relevant to the deployment context. Documented evidence of test case diversity — spanning gender, race, ethnicity, socioeconomic background, disability status, and geographic origin — is expected.

## MAP 1.1 — Context and Purpose

The AI system's context is established and understood. Deployers must document the intended purpose, deployment setting, and populations likely to be affected. This includes identifying protected classes present in the population, historic patterns of disparity in the domain (for example, hiring, lending, healthcare), and any known correlations between input features and protected characteristics. Audits that surface stereotype-consistent responses in a deployment domain like hiring must be treated as high-severity.

## MAP 5.1 — Impact Assessment

Likelihood and magnitude of each identified risk based on expected use, past uses of AI systems in similar contexts, public incident reports, feedback from those external to the team that developed or deployed the AI system, and other data are identified and documented. Risk categories explicitly include allocation harms, representation harms, quality-of-service harms, stereotyping, and denigration. Any measurable stereotyping produced by a general-purpose LLM constitutes a representation harm requiring documented mitigation.

## MEASURE 2.11 — Fairness and Bias

Fairness and bias — as identified in the MAP function — are examined and documented. Measurable indicators of bias include demographic parity gap, equal opportunity difference, calibration error across groups, and disparate impact ratios. Organizations should test across at least the demographic dimensions relevant to the deployment context, using both quantitative statistical tests and qualitative red-teaming for stereotyping and denigration. Testing across gender, race, ethnicity, religion, disability, and age is the baseline expectation for high-impact deployments.

## MEASURE 2.7 — Security and Resilience

AI system security and resilience are evaluated and documented. Adversarial red-teaming — including prompt injection, jailbreak attempts, and adversarial demographic probing — should be part of pre-deployment testing. Findings of successful jailbreaks that lead to biased or harmful output must be reported and remediated. Refusal rate analysis across demographic groups is a valid resilience metric because inconsistent refusal patterns indicate a lack of robust safety behavior.

## MANAGE 1.3 — Response Plans

Responses to the AI risks deemed high-priority as identified by the MAP function are developed, planned, and documented. Response plans must specify triggers (for example, a demographic parity gap exceeding an agreed threshold), owners, remediation actions, and re-testing criteria. Continuous monitoring with automated alerting on drift in fairness metrics is expected for production high-impact systems.

## MANAGE 4.1 — Continuous Monitoring

The AI system's performance and trustworthiness characteristics are continually monitored. Bias metrics are not one-time gates; they are continuously monitored in production because model behavior can drift as the input distribution changes. Deployers should establish a cadence for re-running the full audit battery and a corresponding SLA for addressing regressions.
