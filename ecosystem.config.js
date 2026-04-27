const path = require("path");
const root = __dirname;
const db = path.join(root, "data/app.db");

module.exports = {
  apps: [
    {
      name: "souldb-be",
      script: "go",
      args: `run ./cmd/server -dev -db ${db}`,
      cwd: path.join(root, "backend"),
      interpreter: "none",
      autorestart: false,
      watch: [path.join(root, "backend"), path.join(root, "data/app.db")],
      ignore_watch: ["bin", "*.test.go"],
      watch_delay: 1000,
    },
    {
      name: "souldb-fe",
      script: "pnpm",
      args: "dev",
      cwd: path.join(root, "web"),
      interpreter: "none",
      autorestart: false,
    },
  ],
};
