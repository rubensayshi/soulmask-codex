.PHONY: help dev build parse db sqlc tidy test translate clean deploy icons-sync

help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "  dev          Run backend (live-reload) + Vite dev server"
	@echo "  build        Build SPA + embed into single Go binary at backend/bin/server"
	@echo "  parse        Run all Stage 2 parsers (items, recipes, tech, drops, classify, food buffs)"
	@echo "  db           parse + rebuild data/app.db"
	@echo "  sqlc         Regenerate backend/internal/db/gen/ from queries.sql"
	@echo "  tidy         go mod tidy"
	@echo "  test         Run go + web + python test suites"
	@echo "  translate    Emit tasks/translate_batch.yaml for untranslated items"
	@echo "  deploy       Deploy app to Fly.io"
	@echo "  icons-sync   Upload icons to Tigris CDN"
	@echo "  clean        Remove build artifacts"

dev:
	./dev.sh

parse:
	python3 pipeline/parse_items.py
	python3 pipeline/parse_recipes.py
	python3 pipeline/parse_tech_tree.py
	python3 pipeline/parse_exports.py
	python3 pipeline/classify_items.py
	python3 pipeline/parse_food_buffs.py

db: parse
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

deploy: icons-sync
	fly deploy

icons-sync:
	./scripts/sync-icons.sh

clean:
	rm -rf backend/bin backend/internal/spa/dist/* web/dist web/node_modules data/app.db
	touch backend/internal/spa/dist/.gitkeep
