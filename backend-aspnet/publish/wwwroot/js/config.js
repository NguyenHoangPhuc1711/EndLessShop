/* Shared by every page. No secrets belong in this file. */
(function () {
  'use strict';
  // GitHub Pages uses the public API automatically; local defaults to same-origin.
  // To use another API, replace the expression below with 'https://your-api'.
  // Use '' to always call the current origin. Do not include /api or a trailing slash.
  const API_BASE = location.origin === 'https://nguyenhoangphuc1711.github.io'
    ? 'https://api.puckin.id.vn' : '';
  const base = API_BASE.replace(/\/+$/, '');
  const pageBase = new URL('.', location.href);
  window.EndlessConfig = Object.freeze({
    API_BASE: base,
    pageBase: pageBase.href,
    credentials: new URL(base || location.origin).origin === location.origin ? 'same-origin' : 'include',
    apiUrl: path => base + '/api/' + path.replace(/^\/+/, '')
  });
}());
