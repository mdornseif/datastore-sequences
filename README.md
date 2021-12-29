[![version](https://img.shields.io/npm/v/datastore-sequences.svg)](https://npmjs.org/datastore-sequences)
[![NPM Types](https://img.shields.io/npm/types/datastore-sequences)](https://www.npmjs.com/package/datastore-sequences)
[![Last Commit](https://img.shields.io/github/last-commit/mdornseif/datastore-sequences)](https://github.com/mdornseif/datastore-sequences)
[![license](https://img.shields.io/npm/l/datastore-sequences?color=%23007a1f)](https://github.com/mdornseif/datastore-sequences/blob/master/LICENSE)
[![downloads](https://img.shields.io/npm/dm/datastore-sequences?&color=%23007a1f)](https://npmcharts.com/compare/datastore-sequences)

# datastore-sequences

Generate sequential numbers (auto-increment IDs) in [Google Cloud Datastore](https://cloud.google.com/datastore/docs/reference/libraries#client-libraries-install-nodejs).

Common wisdom is that you can't or at least shouldn't sequentially number records/rows/entities on Google Cloud Datastore. For background see [1](https://stackoverflow.com/questions/2825934), [2](https://stackoverflow.com/questions/3985812), [3](https://stackoverflow.com/questions/7300751), [4](https://stackoverflow.com/questions/47263892) and [5](https://stackoverflow.com/questions/48083309).

While this is sound advice in most cases, there are situations where you need to have sequential numbered things - e.g. invoice numbers.

`datastore-sequences` implements a battle tested approach for slow but save sequence numbering.
There is a strong guarantee that that no ID will be produced more than once.
There is no guarantee that there will never be gaps in the numbering sequence. But this should happen extremely seldom.
Thew usage of different Prefixes allows you to have multiple independent sequences.

To use it, you instantiate with a [@google-cloud/datastore](https://github.com/googleapis/nodejs-datastore) instance and call allocateId:

```js
import { Datastore } from '@google-cloud/datastore';
import { SequenceNumbering } from 'datastore-sequences';
const numbering = new SequenceNumbering(new Datastore());
const newId1 = await numbering.allocateId();
const newId2 = await numbering.allocateId();
console.log(newId1, newId2)
'1' '2'
```

This automatically reties getting a new number on datastore congestion and tries to serialize number generation to avoid datastore congestion.

You can give a prefix to get different namespaces:

```js
const newIds = await Promise.all([
  numbering.allocateId('RG'),
  numbering.allocateId('LS'),
  numbering.allocateId('RG'),
  numbering.allocateId('LS')])
console.log(newIds);
['RG1' 'LS1', 'RG2', 'LS2']
```

You are also encouraged to give a starting value.
This is only needed on the first run for a given Prefix:

```js
const newIds = await Promise.all([
  numbering.allocateId('RG', 10000),
  numbering.allocateId('RG'),
]);
console.log(newIds);
[('RG10001', 'RG10002')];
```

# See also

- [Simplified Datastore API](https://www.npmjs.com/package/datastore-api)
