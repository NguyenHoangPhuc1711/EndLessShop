/* Shared by every page. No secrets belong in this file. */
(function () {
  'use strict';
  // Public Pages artifact. Local defaults stay in the source config.
  const API_BASE = 'https://api.puckin.id.vn';
  const base = API_BASE.replace(/\/+$/, '');
  const pageBase = new URL('.', location.href);
  window.EndlessConfig = Object.freeze({
    API_BASE: base,
    pageBase: pageBase.href,
    credentials: new URL(base || location.origin).origin === location.origin ? 'same-origin' : 'include',
    apiUrl: path => base + '/api/' + path.replace(/^\/+/, '')
  });
}());
