# datastore-sequences

Generate sequential numbers (auto-increment IDs) in Google Cloud Datastore.

Common wisdom is that you can't or at least shouldn't sequentially number records/rows/entities on Google Cloud Datastore. For background see [1](https://stackoverflow.com/questions/2825934), [2](https://stackoverflow.com/questions/3985812), [3](https://stackoverflow.com/questions/7300751), [4](https://stackoverflow.com/questions/47263892) and [5](https://stackoverflow.com/questions/48083309).

While this is sound advice in most cases there are situation where you need to have sequential numbered things - e.g. invoice numbers.

datastore-sequences implements a battle tested approach for slow but save sequence numbering.
There is a strong guarantee that that no ID will be produced more than once.
There is no guarantee that there will never be gaps in the numbering sequence but this should be extremely rare.
Thew usage of different Prefixes allows you to have multiple independent sequences.

To use it, you instantiate with a @google-cloud/datastore instance and call [[allocateId]]:

```js
import { Datastore } from '@google-cloud/datastore';
const numbering = new SequenceNumbering(new Datastore());
const newId = await numbering.allocateId();
```

This automatically reties getting a new number and tries to serialize number generation.
