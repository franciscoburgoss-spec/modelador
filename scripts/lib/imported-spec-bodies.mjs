import { createHash } from 'node:crypto';

const BEGIN_PREFIX = '<!-- IMPORTED-NORMATIVE-BODY:BEGIN ';
const END_MARKER = '<!-- IMPORTED-NORMATIVE-BODY:END -->';

export function extractImportedNormativeBody(documentBytes) {
  const bytes = Buffer.isBuffer(documentBytes) ? documentBytes : Buffer.from(documentBytes);
  const begin = bytes.indexOf(BEGIN_PREFIX);
  if (begin < 0) throw new Error('falta marcador de inicio del cuerpo importado');

  const bodyStart = bytes.indexOf('\n', begin);
  if (bodyStart < 0) throw new Error('marcador de inicio incompleto');

  const bodyEnd = bytes.indexOf(END_MARKER, bodyStart + 1);
  if (bodyEnd < 0) throw new Error('falta marcador de fin del cuerpo importado');
  if (bytes.indexOf(BEGIN_PREFIX, begin + BEGIN_PREFIX.length) >= 0) {
    throw new Error('existe más de un marcador de inicio');
  }
  if (bytes.indexOf(END_MARKER, bodyEnd + END_MARKER.length) >= 0) {
    throw new Error('existe más de un marcador de fin');
  }

  return bytes.subarray(bodyStart + 1, bodyEnd);
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
