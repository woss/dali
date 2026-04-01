# SurrealDB Function Wrappers

Type-safe wrappers for SurrealDB built-in functions. Used in queries, conditions, and computed fields.

Import from `@woss/dali-orm/sdk/functions`:

```typescript
import {
  count,
  math,
  string,
  vector,
  time,
  crypto,
  geo,
  meta,
  session,
  array,
  set,
  value,
  parse,
  type,
  sleep,
  record as rec,
  object,
  sequence,
  rand,
  search,
  bytes,
  duration,
  encoding,
  http,
  files,
  not,
  api,
  sql,
} from '@woss/dali-orm/sdk/functions';
```

## Count

```typescript
count('*'); // COUNT(*)
count('field'); // COUNT(field)
count().distinct(); // COUNT(DISTINCT field)
```

## Math

```typescript
math.abs(-5); // math::abs(-5)
math.ceil(4.2); // math::ceil(4.2)
math.floor(4.7); // math::floor(4.7)
math.round(4.5); // math::round(4.5)
math.max(1, 2, 3); // math::max(1, 2, 3)
math.min(1, 2, 3); // math::min(1, 2, 3)
math.sum(1, 2, 3); // math::sum(1, 2, 3)
math.mean([1, 2, 3]); // math::mean([1,2,3])
math.pow(2, 3); // math::pow(2, 3)
math.sqrt(9); // math::sqrt(9)
math.median([1, 2, 3]); // math::median([1,2,3])
math.fixed(3.14159, 2); // math::fixed(3.14159, 2)
```

## String

```typescript
string.concat('a', 'b'); // string::concat('a', 'b')
string.contains('hello', 'ell'); // string::contains('hello', 'ell')
string.endsWith('hello', 'lo'); // string::endsWith('hello', 'lo')
string.startsWith('hello', 'he'); // string::startsWith('hello', 'he')
string.join(['a', 'b'], ','); // string::join(['a', 'b'], ',')
string.length('hello'); // string::length('hello')
string.lowercase('HELLO'); // string::lowercase('HELLO')
string.uppercase('hello'); // string::uppercase('hello')
string.reverse('hello'); // string::reverse('hello')
string.replace('hello', 'ell', 'ipp'); // string::replace(...)
string.trim('  hello  '); // string::trim('  hello  ')
string.isAlpha('hello'); // string::isAlpha('hello')
string.isAlphanumeric('hello1'); // string::isAlphanumeric(...)
string.isEmail('a@b.com'); // string::isEmail('a@b.com')
string.isUrl('https://x.com'); // string::isUrl('https://x.com')
string.isUuid('abc-def'); // string::isUuid('abc-def')
string.slice('hello', 0, 3); // string::slice('hello', 0, 3)
```

## Vector

```typescript
vector.distance(v1, v2); // vector::distance(v1, v2)
vector.similarityCosine(v1, v2); // vector::similarity::cosine(v1, v2)
vector.similarityEuclidean(v1, v2); // vector::similarity::euclidean(v1, v2)
vector.similarityJaccard(v1, v2); // vector::similarity::jaccard(v1, v2)
vector.similarityPearson(v1, v2); // vector::similarity::pearson(v1, v2)

// Example in query
const results = await orm.query(
  `SELECT *, vector::similarity::cosine(vector, $query) AS score
   FROM memories ORDER BY score DESC LIMIT 5`,
  { query: embedding },
);
```

## Time

```typescript
time.now(); // time::now()
time.day('2024-01-01'); // time::day(...)
time.month('2024-01'); // time::month(...)
time.year('2024'); // time::year(...)
time.hour('12:00'); // time::hour(...)
time.minute('12:30'); // time::minute(...)
time.second('12:30:45'); // time::second(...)
time.floor('2024-01-15T12:30:00Z'); // time::floor(...)
time.round('2024-01-15T12:30:00Z'); // time::round(...)
time.format('2024-01-01', '%Y-%m-%d'); // time::format(...)
time.group('2024-01-01T12:00:00Z', '15m'); // time::group(...)
```

## Type

```typescript
type.bool('true'); // type::bool('true')
type.int('42'); // type::int('42')
type.float('3.14'); // type::float('3.14')
type.string(42); // type::string(42)
type.datetime('2024-01-01'); // type::datetime(...)
type.duration('7d'); // type::duration('7d')
type.decimal('3.14'); // type::decimal('3.14')
type.field('name'); // type::field('name')
type.thing('user', 'abc'); // type::thing('user', 'abc') → user:abc
```

## Record ID Construction

```typescript
import { record } from '@woss/dali-orm/sdk/functions';

// RECORD(id, table)
rec.id('user:abc'); // Creates record reference
```

## Object

```typescript
object.entries({ a: 1, b: 2 }); // object::entries({a: 1, b: 2})
object.extend(obj, other); // object::extend(obj, other)
object.fromEntries([['a', 1]]); // object::from_entries([['a', 1]])
object.isEmpty({}); // object::is_empty({})
object.keys({ a: 1, b: 2 }); // object::keys({a: 1, b: 2})
object.len({ a: 1, b: 2 }); // object::len({a: 1, b: 2})
object.remove(obj, 'a', 'b'); // object::remove(obj, a, b)
object.values({ a: 1, b: 2 }); // object::values({a: 1, b: 2})
```

## Array

```typescript
array.add(['a'], 'b'); // array::add(['a'], 'b')
array.append(['a'], 'b'); // array::append(['a'], 'b')
array.prepend(['b'], 'a'); // array::prepend(['b'], 'a')
array.distinct([1, 1, 2]); // array::distinct([1,1,2])
array.filter([1, 2, 3], (v) => v > 1); // array::filter(...)
array.find([1, 2, 3], (v) => v > 1); // array::find(...)
array.first([1, 2, 3]); // array::first([1,2,3])
array.last([1, 2, 3]); // array::last([1,2,3])
array.len([1, 2, 3]); // array::len([1,2,3])
array.push(['a'], 'b'); // array::push(['a'], 'b')
array.pop(['a', 'b']); // array::pop(['a', 'b'])
array.remove([1, 2, 3], 1); // array::remove([1,2,3], 1)
array.reverse([1, 2, 3]); // array::reverse([1,2,3])
array.sort([3, 1, 2]); // array::sort([3,1,2])
array.swap([1, 2, 3], 0, 2); // array::swap([1,2,3], 0, 2)
```

## Set

```typescript
set.all([1, 2], [2, 3]); // set::all([1,2], [2,3])
set.any([1, 2], [2, 3]); // set::any([1,2], [2,3])
set.difference([1, 2], [2, 3]); // set::difference(...)
set.intersection([1, 2], [2, 3]); // set::intersection(...)
set.union([1, 2], [3, 4]); // set::union(...)
```

## Meta

```typescript
meta.id('user:abc'); // meta::id(user:abc) → 'user:abc'
meta.tb('user:abc'); // meta::tb(user:abc) → 'user'
```

## Session & Crypto

```typescript
session.origin(); // session::origin() — auth origin
session.sc(); // session::sc() — scope name
session.token(); // session::token() — auth token

// Hash functions
crypto.md5('data'); // crypto::md5('data')
crypto.sha1('data'); // crypto::sha1('data')
crypto.sha256('data'); // crypto::sha256('data')
crypto.sha512('data'); // crypto::sha512('data')
crypto.blake3('data'); // crypto::blake3('data')

// Password hashing (generate + compare)
crypto.bcrypt.generate('pw'); // crypto::bcrypt::generate('pw')
crypto.bcrypt.compare('pw', 'h'); // crypto::bcrypt::compare('pw', 'h')
crypto.scrypt.generate('pw'); // crypto::scrypt::generate('pw')
crypto.scrypt.compare('pw', 'h'); // crypto::scrypt::compare('pw', 'h')
crypto.argon2.generate('pw'); // crypto::argon2::generate('pw')
crypto.argon2.compare('pw', 'h'); // crypto::argon2::compare('pw', 'h')
crypto.pbkdf2.generate('pw', 'k'); // crypto::pbkdf2::generate('pw', 'k')
crypto.pbkdf2.compare('pw', 'h'); // crypto::pbkdf2::compare('pw', 'h')

// UUID generation
crypto.uuid.v4(); // crypto::uuid::v4()
crypto.uuid.v7(); // crypto::uuid::v7()
```

## Sequence

```typescript
sequence.next('my_seq'); // sequence::next(my_seq)
sequence.peek('my_seq'); // sequence::peek(my_seq)
sequence.set('my_seq', 5); // sequence::set(my_seq, 5)
```

## Geo

```typescript
geo.distance(p1, p2); // geo::distance(p1, p2)
geo.hash(p); // geo::hash(p)
```

## API

```typescript
api.timeout('5s'); // api::timeout(5s)
```

## Bytes

```typescript
bytes.len(data); // bytes::len(data)
bytes.resize(data, 16); // bytes::resize(data, 16)
bytes.reverse(data); // bytes::reverse(data)
bytes.toString(data); // bytes::to_string(data)
bytes.xor(a, b); // bytes::xor(a, b)
bytes.and(a, b); // bytes::and(a, b)
bytes.or(a, b); // bytes::or(a, b)
```

## Duration

```typescript
duration.days(d); // duration::days(d)
duration.hours(d); // duration::hours(d)
duration.micros(d); // duration::micros(d)
duration.millis(d); // duration::millis(d)
duration.mins(d); // duration::mins(d)
duration.nanos(d); // duration::nanos(d)
duration.secs(d); // duration::secs(d)
duration.weeks(d); // duration::weeks(d)
DURATION_MAX; // duration::max (constant)
```

## Encoding

```typescript
encoding.base64.encode(data); // encoding::base64::encode(data)
encoding.base64.decode(data); // encoding::base64::decode(data)
```

## Files

```typescript
files.get(path); // files::get(path)
files.put(path, data); // files::put(path, data)
files.list(path); // files::list(path)
files.delete(path); // files::delete(path)
files.exists(path); // files::exists(path)
files.info(path); // files::info(path)
```

## HTTP

```typescript
http.get(url); // http::get(url)
http.get(url, headers); // http::get(url, headers)
http.head(url); // http::head(url)
http.post(url, data); // http::post(url, data)
http.post(url, data, hdrs); // http::post(url, data, headers)
http.put(url, data); // http::put(url, data)
http.patch(url, data); // http::patch(url, data)
http.delete(url); // http::delete(url)
http.delete(url, headers); // http::delete(url, headers)
```

## Not

```typescript
not(value); // not(value)
```

## Rand

```typescript
rand(); // rand()
rand.bool(); // rand::bool()
rand.enum('a', 'b'); // rand::enum('a', 'b')
rand.float(); // rand::float()
rand.float(min); // rand::float(min)
rand.float(min, max); // rand::float(min, max)
rand.guid(); // rand::guid()
rand.int(); // rand::int()
rand.int(min); // rand::int(min)
rand.int(min, max); // rand::int(min, max)
rand.string(); // rand::string()
rand.string(16); // rand::string(16)
rand.uuid.v4(); // rand::uuid::v4()
rand.uuid.v7(); // rand::uuid::v7()
```

## Search

```typescript
search.highlight(excerpt); // search::highlight(excerpt)
search.highlight(excerpt, fields); // search::highlight(excerpt, fields)
search.score(excerpt); // search::score(excerpt)
```

## Sleep

```typescript
sleep(100); // sleep(100) — 100ms
```

## String — Additional

```typescript
string.html.encode(str); // string::html::encode(str)
string.html.sanitize(str); // string::html::sanitize(str)
string.distance(a, b); // string::distance(a, b)
string.similarity(a, b); // string::similarity(a, b)
```

## Type — Additional

```typescript
type.field(name); // type::field(name)
type.record(tb, id); // type::record(tb, id)
type.isArray(val); // type::is_array(val)
type.isBool(val); // type::is_bool(val)
type.isDatetime(val); // type::is_datetime(val)
type.isDecimal(val); // type::is_decimal(val)
type.isDuration(val); // type::is_duration(val)
type.isFloat(val); // type::is_float(val)
type.isInt(val); // type::is_int(val)
type.isNumber(val); // type::is_number(val)
type.isObject(val); // type::is_object(val)
type.isPoint(val); // type::is_point(val)
type.isRecord(val); // type::is_record(val)
type.isString(val); // type::is_string(val)
```
