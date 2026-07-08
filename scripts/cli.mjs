/** Shared CLI exit helpers for Node scripts. */

export function exitOk(message) {
  if (message) console.log(message);
  process.exit(0);
}

export function exitWarn(message) {
  console.warn(message);
  process.exit(0);
}

export function exitFail(message) {
  console.error(message);
  process.exit(1);
}
