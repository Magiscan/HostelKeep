import { newlyAddedAttributes } from '../../src/utils/assignment';

const priv = (attrs) => ({ type: 'private', attributes: attrs });

test('new private room: every ticked feature is new', () => {
  expect(newlyAddedAttributes(priv({ Double: true, Twin: true }), undefined))
    .toEqual(['Double', 'Twin']);
});

test('edit: only the feature just ticked is new', () => {
  expect(newlyAddedAttributes(priv({ Double: true, Twin: true }), priv({ Double: true })))
    .toEqual(['Twin']);
});

test('edit with no feature changes writes nothing', () => {
  expect(newlyAddedAttributes(priv({ Double: true }), priv({ Double: true }))).toEqual([]);
});

test('dorm becoming private: all features are new', () => {
  expect(newlyAddedAttributes(priv({ Double: true }), { type: 'dorm', beds: [] }))
    .toEqual(['Double']);
});

test('dorms never get features', () => {
  expect(newlyAddedAttributes({ type: 'dorm', beds: [] }, undefined)).toEqual([]);
});