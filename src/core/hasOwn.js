const hasOwnProperty = Object.prototype.hasOwnProperty;

export function hasOwn(value, property) {
  return hasOwnProperty.call(value, property);
}
