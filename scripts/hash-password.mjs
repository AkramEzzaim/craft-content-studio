import { randomBytes, scryptSync } from "node:crypto";
if (!process.stdin.isTTY) throw new Error("Run this command in an interactive terminal");
process.stdout.write("Admin password (at least 16 characters): ");
process.stdin.setRawMode(true);
process.stdin.resume();
let password = "";
process.stdin.on("data", (chunk) => {
  for (const char of String(chunk)) {
    if (char === "\r" || char === "\n") {
      process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write("\n");
      if (password.length < 16) { process.stderr.write("Use at least 16 characters\n"); process.exitCode = 1; return; }
      const salt = randomBytes(32);
      console.log(`ADMIN_PASSWORD_HASH=scrypt:${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`);
      password = ""; return;
    }
    if (char === "\u0003") { process.stdin.setRawMode(false); process.stdout.write("\n"); process.exit(130); }
    if (char === "\u007f") password = password.slice(0, -1);
    else password += char;
  }
});
