.PHONY: governance doctor foundation

governance:
	node scripts/validate-governance.mjs

doctor:
	bash scripts/doctor.sh

foundation:
	bash scripts/validate-foundation.sh

