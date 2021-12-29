/* Sequential Numbering
 * Created by Dr. Maximillian Dornseif 2020-10-15
 * Copyright 2020, 2021 Maximillian Dornseif
 */

import { Datastore, Transaction } from '@google-cloud/datastore';
import DatastoreEntity from '@google-cloud/datastore/build/src/entity';
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
  constructor(
    readonly datastore = new Datastore(),
    readonly kindNamePrefix = 'Numbering'
  ) {
    this.ancestorKindName = `${kindNamePrefix}Ancestor`;
    this.itemKindName = `${kindNamePrefix}Item`;
  }

  /** The workhorse, generating a new unique ID for a certain Sequence.
   *
   * @param prefix String

    Contains serialized Access within a single Node Process and automatic retires up to 5 Seconds.
   */
  async allocateId(prefix = '', initialId = 1): Promise<string> {
    const run = async (): Promise<string> =>
      await this.allocateSequenceIdOnce(prefix, initialId);
    return await pRetry(run, {
      maxRetryTime: 5000,
      randomize: true,
    });
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
    const transaction = this.datastore.transaction();
    await transaction.run();

    const ancestorKey = this.datastore.key([
      this.ancestorKindName,
      prefix != '' ? prefix : '(empty)',
    ]);
    const [newId, ancestor] = await this.getNewId(
      transaction,
      ancestorKey,
      prefix,
      initialId
    );
    const designator = `${prefix}${newId}`;
    debug('new Designator:%s id:%s', designator, newId);
    const itemKey = this.datastore.key([
      this.ancestorKindName,
      prefix != '' ? prefix : '(empty)',
      this.itemKindName,
      designator,
    ]);

    // Dupes really should not happen, but better save than sorry
    await this.preventDupe(transaction, itemKey);

    transaction.upsert([
      {
        key: ancestorKey,
        data: { ...ancestor, lastId: newId, updated_at: new Date() },
      },
    ]);
    transaction.insert([
      {
        key: itemKey,
        data: { id: newId, designator },
      },
    ]);
    await transaction.commit();
    return designator;
  }

  private async preventDupe(
    transaction: Transaction,
    itemKey: DatastoreEntity.entity.Key
  ): Promise<void> {
    const [datastoreItem] = await transaction.get(itemKey);
    debug('found (undefined is good): %o', datastoreItem);
    // const itemQuery = transaction.createQuery('NumberingItem')
    // itemQuery.filter('__key__', itemKey)
    // const [data] = await transaction.runQuery(itemQuery)
    // const [datastoreItem] = data
    if (datastoreItem && itemKey === datastoreItem[this.datastore.KEY]) {
      // The entity already exists.
      await transaction.rollback();
      throw new Error(`Duplicate entity ${JSON.stringify(itemKey)}`);
    }
  }

  async getNewId(
    transaction: Transaction,
    ancestorKey: DatastoreEntity.entity.Key,
    prefix: string,
    initialId: number
  ): Promise<[number, DatastoreEntity.Entity]> {
    // const ancestorQuery = transaction.createQuery(this.ancestorKindName)
    // ancestorQuery.filter('__key__', ancestorKey)
    // const [data] = await transaction.runQuery(ancestorQuery)
    const [data] = await transaction.get(ancestorKey);
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
