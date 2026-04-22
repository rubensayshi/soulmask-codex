.PHONY: help dev build db sqlc tidy test translate clean

help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "  dev        Run backend (live-reload) + Vite dev server"
	@echo "  build      Build SPA + embed into single Go binary at backend/bin/server"
	@echo "  db         Rebuild data/app.db from Game/Parsed/*.json + translations"
	@echo "  sqlc       Regenerate backend/internal/db/gen/ from queries.sql"
	@echo "  tidy       go mod tidy"
	@echo "  test       Run go + web + python test suites"
	@echo "  translate  Emit tasks/translate_batch.yaml for untranslated items"
	@echo "  clean      Remove build artifacts"

dev:
	./dev.sh

db:
	python3 pipeline/build_db.py

sqlc:
	cd backend && sqlc generate

tidy:
	cd backend && go mod tidy

test:
	cd backend && go test ./...
	cd web && pnpm test -- --run
	pytest pipeline/

translate:
	python3 pipeline/generate_translations.py

build: sqlc
	cd web && pnpm install && pnpm build
	rm -rf backend/internal/spa/dist
	cp -r web/dist backend/internal/spa/dist
	touch backend/internal/spa/dist/.gitkeep
	cd backend && go build -o bin/server ./cmd/server

clean:
	rm -rf backend/bin backend/internal/spa/dist/* web/dist web/node_modules data/app.db
	touch backend/internal/spa/dist/.gitkeep
