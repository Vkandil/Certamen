import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import type { Certamen } from '../domain/types';
import { redactSecrets } from './redact';

export function certamenToPermalink(certamen: Certamen, origin = window.location.origin + window.location.pathname): string | undefined {
  const clone = stripSnapshots(certamen);
  const compressed = deflateSync(strToU8(redactSecrets(JSON.stringify(clone))));
  if (compressed.byteLength > 50 * 1024) return undefined;
  return `${origin}#c=${base64url(compressed)}`;
}

export function certamenFromPermalink(hash: string): Certamen | undefined {
  const value = hash.match(/[#&]c=([^&]+)/)?.[1];
  if (!value) return undefined;
  const bytes = fromBase64url(value);
  return JSON.parse(strFromU8(inflateSync(bytes))) as Certamen;
}

function stripSnapshots(certamen: Certamen): Certamen {
  return {
    ...certamen,
    responsiones: certamen.responsiones.map((responsio) => ({
      ...responsio,
      requestSnapshot: { model: responsio.modelId, messages: [], stream: true }
    }))
  };
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64url(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
