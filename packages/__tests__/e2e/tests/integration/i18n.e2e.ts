import * as de from '../../src/locales/de/translations.json';
import * as en from '../../src/locales/en/translations.json';

interface Spec {
  name: string;
  suts: { selector: string; expected?: string; expectedDe?: string }[];
  isHtmlContent?: boolean;
}

describe('i18n', () => {
  beforeEach(() => { cy.visit('/'); });

  const assertContent = (selector: string, expected: string, isHtmlContent: boolean | undefined = false) => {
    cy.get(selector).should(isHtmlContent ? 'have.html' : 'have.text', expected);
  };

  const dispatchedOn = new Date(2020, 1, 10, 5, 15).toString(), deliveredOn = new Date(2021, 1, 10, 5, 15).toString(),
    enDeliveredText = en.status_delivered.replace('{{date}}', deliveredOn),
    deDeliveredText = de.status_delivered.replace('{{date}}', deliveredOn);

  const enSpecificTests: Spec[] = [
    {
      name: 'should work for attribute translation',
      suts: [{ selector: `#i18n-attr[title="${en.simple.attr}"]`, expected: 'attribute test' }]
    },
    {
      name: 'should work for semicolon delimited multiple attributes',
      suts: [{ selector: `#i18n-multiple-attr[title="${en.simple.attr}"]`, expected: en.simple.text }]
    },
    {
      name: 'should work when same key is used for multiple attributes',
      suts: [{ selector: `#i18n-multiple-attr-same-key[title="${en.simple.attr}"][data-foo="${en.simple.attr}"]`, expected: en.simple.text }]
    },
  ];
  const specs: Spec[] = [
    {
      name: 'should work for simple text-content',
      suts: [{ selector: `#i18n-simple`, expected: en.simple.text, expectedDe: de.simple.text }]
    },
    {
      name: 'should work when key is bound from vm property',
      suts: [{ selector: `#i18n-vm-bound`, expected: en.simple.text, expectedDe: de.simple.text }]
    },
    {
      name: 'should work for interpolation',
      suts: [
        { selector: `#i18n-interpolation`, expected: enDeliveredText, expectedDe: deDeliveredText },
        { selector: `#i18n-interpolation-custom`, expected: enDeliveredText, expectedDe: deDeliveredText },
        { selector: `#i18n-interpolation-es6`, expected: enDeliveredText, expectedDe: deDeliveredText },
      ]
    },
    {
      name: 'should work for context specific translation',
      suts: [
        { selector: `#i18n-ctx`, expected: en.status, expectedDe: de.status },
        {
          selector: `#i18n-ctx-dispatched`,
          expected: en.status_dispatched.replace('{{date}}', dispatchedOn),
          expectedDe: de.status_dispatched.replace('{{date}}', dispatchedOn),
        },
        { selector: `#i18n-ctx-delivered`, expected: enDeliveredText, expectedDe: deDeliveredText, },
      ]
    },
    {
      name: 'should work for pluralization',
      suts: [
        {
          selector: `#i18n-items-plural-0`,
          expected: en.itemWithCount_plural.replace('{{count}}', '0'),
          expectedDe: de.itemWithCount_plural.replace('{{count}}', '0')
        },
        {
          selector: `#i18n-items-plural-1`,
          expected: en.itemWithCount.replace('{{count}}', '1'),
          expectedDe: de.itemWithCount.replace('{{count}}', '1'),
        },
        {
          selector: `#i18n-items-plural-10`,
          expected: en.itemWithCount_plural.replace('{{count}}', '10'),
          expectedDe: de.itemWithCount_plural.replace('{{count}}', '10'),
        },
      ]
    },
    {
      name: 'should work for interval processing and nesting',
      suts: [
        { selector: `#i18n-interval-0`, expected: '0 items', expectedDe: '0 Artikel' },
        { selector: `#i18n-interval-1`, expected: '1 item', expectedDe: '1 Artikel' },
        { selector: `#i18n-interval-2`, expected: '2 items', expectedDe: '2 Artikel' },
        { selector: `#i18n-interval-3`, expected: '3 items', expectedDe: '3 Artikel' },
        { selector: `#i18n-interval-6`, expected: '6 items', expectedDe: '6 Artikel' },
        { selector: `#i18n-interval-7`, expected: 'a lot of items', expectedDe: 'viele Artikel' },
        { selector: `#i18n-interval-10`, expected: 'a lot of items', expectedDe: 'viele Artikel' },
      ]
    },
  ];

  describe('translates via HTML that', () => {
    for (const { name, suts, isHtmlContent } of specs) {
      it(name, () => {
        for (const sut of suts) {
          assertContent(sut.selector, sut.expected, isHtmlContent);
        }
      });
    }
  });

  it('sets the src attribute of img elements by default', () => {
    cy.get('#i18n-img').should('have.attr', 'src', en.imgPath);
  });

});
