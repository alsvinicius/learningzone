.PHONY: check check-public test serve serve-private clean

PORT ?= 8000

check: test
	python3 tools/check.py

check-public: check
	python3 tools/check_public.py

test:
	python3 -m unittest discover -s tests
	node --test tests/*.test.cjs
serve: check
	@echo "Skill Builder: http://localhost:$(PORT)/"
	python3 -m http.server $(PORT) --bind 127.0.0.1

serve-private:
	python3 tools/use_private_catalog.py
	$(MAKE) serve
clean:
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
