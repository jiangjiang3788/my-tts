const LOG_PREFIX = "【tts】";

export function log(...args) {
  console.log(LOG_PREFIX, ...args);
}
export function logWarn(...args) {
  console.warn(LOG_PREFIX, ...args);
}
export function logError(...args) {
  console.error(LOG_PREFIX, ...args);
}
export function logDebug(...args) {
  console.debug(LOG_PREFIX, ...args);
}
