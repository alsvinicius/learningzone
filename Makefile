PROJECT_GALLERY_MK := $(wildcard .project-gallery.mk)
-include .project-gallery.mk

.PHONY: check check-public test serve serve-private start stop clean

ifeq ($(PROJECT_GALLERY_MK),.project-gallery.mk)
ifneq ($(origin WEB_PORT),file)
$(error .project-gallery.mk must define WEB_PORT for Project Gallery)
endif
PORT ?= $(WEB_PORT)
else
WEB_PORT ?= 8000
PORT ?= $(WEB_PORT)
endif
GALLERY_PROCESS := scripts/gallery-process.sh
GALLERY_PID := .gallery/web.pid
GALLERY_LOG := .gallery/web.log

check: test
	python3 tools/check.py

check-public: check
	python3 tools/check_public.py

test:
	python3 -m unittest discover -s tests
	node --test tests/*.test.cjs
serve: check
	@echo "Skill Builder: http://localhost:$(PORT)/"
	WEB_PORT=$(PORT) python3 scripts/serve.py

start:
	@bash $(GALLERY_PROCESS) start $(GALLERY_PID) $(GALLERY_LOG) $(WEB_PORT) env WEB_PORT=$(WEB_PORT) python3 scripts/serve.py

stop:
	@bash $(GALLERY_PROCESS) stop $(GALLERY_PID) $(GALLERY_LOG) $(WEB_PORT)

serve-private:
	@test -f .local/private-data/index.personal.json || { echo "No local catalog backup found at .local/private-data/index.personal.json." >&2; exit 1; }
	PRIVATE_INDEX_PATH=.local/private-data/index.personal.json WEB_PORT=$(PORT) $(MAKE) serve
clean:
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
