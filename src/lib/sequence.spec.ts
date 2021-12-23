/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * sequence.spec.ts
 *
 * Created by Dr. Maximillian Dornseif 2021-12-14 in datastore-sequences 1.0.0
 * Copyright (c) 2021 Dr. Maximillian Dornseif GmbH
 */

import { Datastore } from '@google-cloud/datastore';
import test from 'ava';
import Emulator from 'google-datastore-emulator';

import { SequenceNumbering } from './sequence';

process.env.GCLOUD_PROJECT = 'project-id'; // Set the datastore project Id globally
process.env.CLOUDSDK_CORE_DISABLE_PROMPTS = '1 ';
let emulator;

test.before(async (_t) => {
  emulator = new Emulator({ useDocker: false, debug: false });
  await emulator.start();
});

test('numbering', async (t) => {
  const numbering = new SequenceNumbering(new Datastore());
  let newId = await numbering.allocateId('TST', 10_000);
  t.log('bla');
  t.deepEqual(newId, 'TST10000');
  newId = await numbering.allocateId('TST', 10_000);
  t.deepEqual(newId, 'TST10001');
  newId = await numbering.allocateId('TST', 10_000);
  t.deepEqual(newId, 'TST10002');
  newId = await numbering.allocateId('TST');
  t.deepEqual(newId, 'TST10003');

  newId = await numbering.allocateId('TEST');
  t.deepEqual(newId, 'TEST1');
});

test.after('cleanup', async (_t) => {
  await emulator.stop();
});
