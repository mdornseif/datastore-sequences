/* Sequential Numbering
 * Created by Dr. Maximillian Dornseif 2020-10-15
 * Copyright 2020, 2021 Maximillian Dornseif
 */

import { assertIsString } from 'assertate-debug';
import { Datastore, Dstore, IDstoreEntry, Key } from 'datastore-api';
import Debug from 'debug';
import pLimit from 'p-limit';
import pRetry from 'p-retry';

const debug = Debug('ds:sequences');

// Max Concurrency of 1 promise at once
const limit = pLimit(1);

/** Generate sequential numbers (auto-increment IDs) in Google App Engine.

Common wisdom is that you can't or at least shouldn't sequentially number records/rows/entities on Google App Engine.
See for background [1](https://stackoverflow.com/questions/2825934), [2](https://stackoverflow.com/questions/3985812), [3](https://stackoverflow.com/questions/7300751), [4](https://stackoverflow.com/questions/47263892) and [5](https://stackoverflow.com/questions/48083309).

While this is sound advice in most cases there are situation where you need to have sequential numbered things - e.g. invoice numbers.

This class implements a battle tested approach vor slow but save sequence numbering.
There is a strong guarantee that that no ID  will be produced more than once.
There is no guarantee that there will never be gaps in the numbering sequence but this should be extremely rare.
Thew usage of different Prefixes allows you to have multiple independent sequences.

To use it, you instantiate with a @google-cloud/datastore instance and call [[allocateId]]:

```js
import { Datastore } from '@google-cloud/datastore';
const numbering = new SequenceNumbering(new Datastore())
const newId = await numbering.allocateId()
```

This automatically reties getting a new number and tries to serialize number generation.

@param datastore Instance of Datastore. Might contain Project ID and namespace.

@param itemKindName Prefix to use for Storage. By default the Kinds/Tables `NumberingAncestor` and `NumberingItem` are used.

 */
export class SequenceNumbering {
  ancestorKindName: string;
  itemKindName: string;
  dstore: Dstore;
  constructor(
    readonly datastore = new Datastore(),
    readonly kindNamePrefix = 'Numbering'
  ) {
    this.ancestorKindName = `${kindNamePrefix}Ancestor`;
    this.itemKindName = `${kindNamePrefix}Item`;
    this.dstore = new Dstore(this.datastore, process.env.GCLOUD_PROJECT);
  }

  /** The workhorse, generating a new unique ID for a certain Sequence.
   *
   * @param prefix String

    Contains serialized Access within a single Node Process and automatic retires up to 5 Seconds.
   */
  async allocateId(prefix = '', initialId = 1): Promise<string> {
    const run = async (): Promise<string> =>
      await this.allocateSequenceIdOnce(prefix, initialId);
    try {
      return await pRetry(run, {
        maxRetryTime: 10000,
        randomize: true,
      });
    } catch (error) {
      console.error(error);
      throw new error();
    }
  }

  async allocateSequenceIdOnce(
    prefix: string,
    initialId: number
  ): Promise<string> {
    return await limit(() => this._allocateIdOnceUnlimited(prefix, initialId));
  }

  async _allocateIdOnceUnlimited(
    prefix: string,
    initialId: number
  ): Promise<string> {
    let designator;

    const ancestorKey = this.dstore.key([
      this.ancestorKindName,
      prefix != '' ? prefix : '(empty)',
    ]);
    const txn = async () => {
      const [newId, ancestor] = await this.getNewId(
        ancestorKey,
        prefix,
        initialId
      );
      designator = `${prefix}${newId}`;
      debug('new Designator:%s id:%s', designator, newId);
      const itemKey = this.dstore.key([
        this.ancestorKindName,
        prefix != '' ? prefix : '(empty)',
        this.itemKindName,
        designator,
      ]);

      // Dupes really should not happen, but better safe than sorry
      await this.preventDupe(itemKey);

      this.dstore.save([
        {
          key: ancestorKey,
          data: { ...ancestor, lastId: newId, updated_at: new Date() },
        },
      ]);
      this.dstore.insert([
        {
          key: itemKey,
          data: { id: newId, designator },
        },
      ]);
    };
    await this.dstore.runInTransaction(txn);
    assertIsString(designator);
    return designator;
  }

  private async preventDupe(itemKey: Key): Promise<void> {
    const datastoreItem = await this.dstore.get(itemKey);
    debug('found (undefined is good): %o', datastoreItem);
    // const itemQuery = transaction.createQuery('NumberingItem')
    // itemQuery.filter('__key__', itemKey)
    // const [data] = await transaction.runQuery(itemQuery)
    // const [datastoreItem] = data
    if (
      datastoreItem &&
      JSON.stringify(itemKey.path) ==
        JSON.stringify(datastoreItem[Datastore.KEY].path)
    ) {
      debug('`Duplicate entity %o', JSON.stringify(itemKey));
      // The entity already exists: rollback
      // await transaction.rollback();
      throw new Error(`Duplicate entity ${JSON.stringify(itemKey)}`);
    }
  }

  async getNewId(
    ancestorKey: Key,
    prefix: string,
    initialId: number
  ): Promise<[number, IDstoreEntry]> {
    // const ancestorQuery = transaction.createQuery(this.ancestorKindName)
    // ancestorQuery.filter('__key__', ancestorKey)
    // const [data] = await transaction.runQuery(ancestorQuery)
    const data = await this.dstore.get(ancestorKey);
    let ancestor;

    if (!data || data.length === 0) {
      ancestor = { prefix, lastId: initialId - 1, created_at: new Date() };
      debug('no ancestor, starting with %o', ancestor);
    } else {
      ancestor = data;
      debug('using existing ancestor %o', ancestor);
    }
    return [Number(ancestor?.lastId ?? 0) + 1, ancestor];
  }
}
