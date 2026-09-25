# Buzzed

Buzzed is a small, personal macOS menu bar app that keeps an Apple-silicon Mac awake while long-running coding agents finish their work.

## Development

Requirements: macOS on Apple silicon, Node.js, and npm.

```sh
npm install
npm start
```

Buzzed starts inactive. Use the coffee cup in the menu bar to enable an indefinite session or choose a timer.

## Checks and packaging

```sh
npm test
npm run typecheck
npm run make
```

The packaged app and ZIP are written under `out/`. They are intentionally unsigned and unnotarized. After moving `Buzzed.app` to `/Applications`, macOS may require manual approval for Launch at Login under **System Settings → General → Login Items**.

Buzzed invokes `/usr/bin/caffeinate -d -i -w <pid>`. It prevents display sleep and idle system sleep, but it cannot prevent forced sleep when a MacBook lid is closed.
