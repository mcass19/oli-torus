import React from 'react';
import { Modal } from 'components/modal/Modal';
import { consentOptions, setCookies } from 'components/cookies/utils';
import {
  selectCookiePreferences,
  CookiePreferencesProps,
} from 'components/cookies/CookiePreferences';
import ReactDOM from 'react-dom';

export const CookieConsent = (cookiePreferences: CookiePreferencesProps) => {
  return (
    <div className="form-inline">
      <p>
        We use cookies on our website to enhance site navigation, analyze site usage, and assist in
        our marketing efforts. By clicking &quot;Accept&quot;, you consent to the storing of cookies
        on your device. You can change your cookie settings at any time by clicking &quot;Cookie
        Preferences&quot;
      </p>
      <p>
        <a href={cookiePreferences.privacyPoliciesUrl}>Privacy Notice</a>
      </p>
    </div>
  );
};

export function selectCookieConsent(cookiePreferences: CookiePreferencesProps): void {
  const footer = (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          dismiss();
          storeConsent();
        }}
      >
        Accept
      </button>
      <button
        type="button"
        className="btn btn-outline-primary"
        onClick={() => {
          dismiss();
          selectCookiePreferences(cookiePreferences);
        }}
      >
        Cookie Preferences
      </button>
    </>
  );
  const cookieConsent = (
    <Modal
      title="We use cookies"
      footer={footer}
      onCancel={() => {
        dismiss();
      }}
    >
      <CookieConsent privacyPoliciesUrl={cookiePreferences.privacyPoliciesUrl} />
    </Modal>
  );

  display(cookieConsent);
}

const storeConsent = () => {
  const userOptions = consentOptions();
  const days = 365 * 24 * 60 * 60 * 1000;
  setCookies([
    { name: '_cky_opt_choices', value: JSON.stringify(userOptions), duration: days },
    { name: '_cky_opt_in', value: 'true', duration: days },
  ]);
};

const display = (c: any) => {
  let cookieConsentEl = document.querySelector('#cookie_consent_display');
  if (!cookieConsentEl) {
    cookieConsentEl = document.createElement('div');
    cookieConsentEl.id = 'cookie_consent_display';
    document.body.appendChild(cookieConsentEl);
  }
  ReactDOM.render(c, cookieConsentEl);
};

const dismiss = () => {
  const cookiePrefs = document.querySelector('#cookie_consent_display');
  if (cookiePrefs) {
    ReactDOM.unmountComponentAtNode(cookiePrefs);
  }
};
