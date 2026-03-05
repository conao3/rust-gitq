.PHONY: install
install:
	pnpm install

.PHONY: dev
dev:
	pnpm tauri dev

.PHONY: dev-web
dev-web:
	pnpm dev

.PHONY: build
build:
	pnpm tauri build

.PHONY: react-devtools
react-devtools:
	pnpm react-devtools

.PHONY: fmt
fmt:
	nix fmt

.PHONY: clean
clean:
	rm -rf node_modules dist src-tauri/target
