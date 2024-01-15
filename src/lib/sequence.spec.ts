/*
 * sequence.spec.ts Tests against the Google Datastore Emulator
 *
 * Created by Dr. Maximillian Dornseif 2021-12-14 in datastore-sequences 1.0.0
 * Copyright (c) 2021, 2024 Dr. Maximillian Dornseif
 */

import { Datastore } from '@google-cloud/datastore';
import Emulator from 'google-datastore-emulator';
import { afterAll, beforeAll, expect, test } from 'vitest';

import { SequenceNumbering } from './sequence';

process.env.GCLOUD_PROJECT = 'project-id'; // Set the datastore project Id globally
process.env.CLOUDSDK_CORE_DISABLE_PROMPTS = '1 ';
let emulator;

beforeAll(async () => {
  emulator = new Emulator({ useDocker: false, debug: false });
  await emulator.start();
});

afterAll(async () => {
  await emulator.stop();
});

test('numbering without prefix', async () => {
  const numbering = new SequenceNumbering(new Datastore());
  const newId = await numbering.allocateId();
  expect(newId).toBe('1');
});

test('numbering with prefix', async () => {
  const numbering = new SequenceNumbering(new Datastore());
  let newId = await numbering.allocateId('TST', 10_000);
  expect(newId).toBe('TST10000');
  newId = await numbering.allocateId('TEST');
  expect(newId).toBe('TEST1');
});

test('numbering repeated', async () => {
  const numbering = new SequenceNumbering(new Datastore());
  let newId = await numbering.allocateId('TST2_', 10_000);
  expect(newId).toBe('TST2_10000');
  newId = await numbering.allocateId('TST2_', 10_000);
  expect(newId).toBe('TST2_10001');
  newId = await numbering.allocateId('TST2_', 10_000);
  expect(newId).toBe('TST2_10002');
  newId = await numbering.allocateId('TST2_');
  expect(newId).toBe('TST2_10003');
});

test('numbering parallel', async () => {
  const numbering = new SequenceNumbering(new Datastore());
  const ids = await Promise.all([
    numbering.allocateId('TST3_', 10_000),
    numbering.allocateId('TST3_', 10_000),
    numbering.allocateId('TST3_', 10_000),
    numbering.allocateId('TST3_', 10_000),
    numbering.allocateId('TST3_', 10_000),
    numbering.allocateId('TEST3_'),
    numbering.allocateId('TEST3_'),
  ]);
  expect(ids).toEqual([
    'TST3_10000',
    'TST3_10001',
    'TST3_10002',
    'TST3_10003',
    'TST3_10004',
    'TEST3_1',
    'TEST3_2',
  ]);
});
