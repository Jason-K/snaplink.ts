# Karabiner schema validation
#
# Lives in ~/Scripts/apps/karabiner/snaplink.ts/schema/.
# Validates the TypeScript build output and the live karabiner.json against
# karabiner-rule.schema.json.
#
#   make help              list targets
#   make deps              install jsonschema into the shared venv
#   make validate          build output + live config
#   make check             npm check -> regenerate (dry-run) -> validate
#   make install-hooks     install the git pre-commit hook into the config repo

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

HERE        := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
KARABINER_SRC ?= $(abspath $(HERE)/..)
KE_CONFIG   ?= $(HOME)/.config/karabiner/karabiner.json
KE_ASSETS   ?= $(HOME)/.config/karabiner/assets/complex_modifications
BUILD_OUT   ?= $(KARABINER_SRC)/karabiner-output.json

VENV_PY     ?= $(HOME)/Scripts/.venv/shared_venv/bin/python3
PYTHON      := $(shell [ -x "$(VENV_PY)" ] && echo "$(VENV_PY)" || command -v python3)
VALIDATE    := $(PYTHON) $(HERE)/validate_karabiner.py

LOG_DIR     := $(HOME)/.local/state/karabiner/snaplink.ts/schema
LOG_FILE    := $(LOG_DIR)/log.txt

.PHONY: help deps schema keycodes validate validate-output validate-config \
        validate-assets generate check install-hooks uninstall-hooks schema-selftest

help:
	@echo "targets:"
	@echo "  deps             install jsonschema into $(VENV_PY)"
	@echo "  schema           regenerate karabiner-rule.schema.json from keycodes + gen_schema.py"
	@echo "  keycodes         refresh key names: make keycodes KE_SRC=/path/to/Karabiner-Elements"
	@echo "  validate         validate build output and live karabiner.json"
	@echo "  validate-output  validate $(BUILD_OUT)"
	@echo "  validate-config  validate $(KE_CONFIG)"
	@echo "  validate-assets  validate $(KE_ASSETS)/*.json"
	@echo "  generate         dry-run build (writes karabiner-output.json only)"
	@echo "  check            npm run check, then generate, then validate"
	@echo "  install-hooks    install the pre-commit hook into the config repo"
	@echo "  uninstall-hooks  remove it"
	@echo "  schema-selftest  confirm the schema itself is well-formed"
	@echo ""
	@echo "vars: KARABINER_SRC=$(KARABINER_SRC)"
	@echo "      LENIENT=1 to accept key-code names newer than the schema"

$(LOG_DIR):
	@mkdir -p "$(LOG_DIR)"

LENIENT_FLAG := $(if $(LENIENT),--lenient,)

define log
@printf '%s %s\n' "$$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(1)" >> "$(LOG_FILE)"
endef

UV := $(shell command -v uv 2>/dev/null)

deps:
	@if [ ! -x "$(VENV_PY)" ]; then echo "shared venv python not found at $(VENV_PY); using $(PYTHON)"; fi
	@if [ -n "$(UV)" ]; then \
	  "$(UV)" pip install --python "$(PYTHON)" jsonschema; \
	elif "$(PYTHON)" -m pip --version >/dev/null 2>&1; then \
	  "$(PYTHON)" -m pip install --quiet jsonschema; \
	else \
	  echo "no pip in $(PYTHON) — bootstrapping via ensurepip" >&2; \
	  "$(PYTHON)" -m ensurepip --upgrade >/dev/null && "$(PYTHON)" -m pip install --quiet jsonschema; \
	fi
	@"$(PYTHON)" -c 'import jsonschema; print("jsonschema", jsonschema.__version__, "in", "$(PYTHON)")'

schema: $(HERE)/karabiner-rule.schema.json

$(HERE)/karabiner-rule.schema.json: $(HERE)/gen_schema.py $(HERE)/karabiner-keycodes.json
	"$(PYTHON)" "$(HERE)/gen_schema.py"

keycodes:
	@if [ -z "$(KE_SRC)" ]; then \
	  echo "usage: make keycodes KE_SRC=/path/to/Karabiner-Elements" >&2; exit 2; \
	fi
	"$(PYTHON)" "$(HERE)/extract_keycodes.py" "$(KE_SRC)"
	$(MAKE) --no-print-directory schema

schema-selftest: schema
	@"$(PYTHON)" -c "import json,sys; from jsonschema import Draft202012Validator as V; \
	V.check_schema(json.load(open('$(HERE)/karabiner-rule.schema.json'))); print('schema ok')"

validate-output: schema | $(LOG_DIR)
	@if [ ! -f "$(BUILD_OUT)" ]; then \
	  echo "no build output at $(BUILD_OUT) — run 'make generate' first" >&2; exit 2; \
	fi
	$(VALIDATE) --node output $(LENIENT_FLAG) "$(BUILD_OUT)"
	$(call log,validate-output ok $(BUILD_OUT))

validate-config: schema | $(LOG_DIR)
	@if [ ! -f "$(KE_CONFIG)" ]; then \
	  echo "no config at $(KE_CONFIG)" >&2; exit 2; \
	fi
	$(VALIDATE) --node karabiner $(LENIENT_FLAG) "$(KE_CONFIG)"
	$(call log,validate-config ok $(KE_CONFIG))

validate-assets: schema | $(LOG_DIR)
	@shopt -s nullglob; \
	files=("$(KE_ASSETS)"/*.json); \
	if [ $${#files[@]} -eq 0 ]; then echo "no asset files in $(KE_ASSETS) (skipping)"; exit 0; fi; \
	$(VALIDATE) --node file $(LENIENT_FLAG) "$${files[@]}"
	$(call log,validate-assets ok)

validate: validate-output validate-config

generate:
	cd "$(KARABINER_SRC)" && CI=true npm run --silent generate

# The npm `check` script now owns the full gate (codegen drift -> typecheck ->
# lint -> test -> generate -> validate), so this target is a thin alias. It does
# not recurse: npm's `validate` shells back into `make validate-output`, not here.
check:
	cd "$(KARABINER_SRC)" && npm run --silent check

HOOK_SRC := $(HERE)/hooks/pre-commit

install-hooks:
	@hooks_dir="$$(cd "$(KARABINER_SRC)" && git rev-parse --git-path hooks)"; \
	hooks_dir="$$(cd "$(KARABINER_SRC)" && cd "$$hooks_dir" 2>/dev/null && pwd || echo "")"; \
	if [ -z "$$hooks_dir" ]; then \
	  hooks_dir="$$(cd "$(KARABINER_SRC)" && git rev-parse --absolute-git-dir)/hooks"; \
	  mkdir -p "$$hooks_dir"; \
	fi; \
	target="$$hooks_dir/pre-commit"; \
	if [ -e "$$target" ] && [ ! -L "$$target" ]; then \
	  cp -p "$$target" "$$target.bak_$$(date +%Y%m%d_%H%M%S)"; \
	  echo "backed up existing hook"; \
	fi; \
	ln -sfn "$(HOOK_SRC)" "$$target"; \
	chmod +x "$(HOOK_SRC)"; \
	echo "installed: $$target -> $(HOOK_SRC)"

uninstall-hooks:
	@hooks_dir="$$(cd "$(KARABINER_SRC)" && git rev-parse --absolute-git-dir)/hooks"; \
	target="$$hooks_dir/pre-commit"; \
	if [ -L "$$target" ]; then rm "$$target"; echo "removed $$target"; \
	else echo "no symlinked hook at $$target (left alone)"; fi
