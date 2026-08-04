.PHONY: governance codex-audit doctor foundation

governance:
	node scripts/validate-governance.mjs

codex-audit:
	node scripts/codex-spec.mjs --audit

doctor:
	bash scripts/doctor.sh

foundation:
	bash scripts/validate-foundation.sh
