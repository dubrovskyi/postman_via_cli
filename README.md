# Postman via CLI

Run Postman collections from the command line and on CI, with HTML and Allure reports.

You export a collection from Postman, drop it into `collections/`, and the same
command runs it locally and in the pipeline.

## Requirements

- Node.js 18+ (https://nodejs.org)

## Quick start

```bash
npm ci
./start.sh collections/postman-echo.postman_collection.json environments/postman-echo.postman_environment.json
```

The wrapper installs dependencies on first run, wipes the previous reports and
runs the collection. A green run means the whole chain works.

## The bundled collections

| Collection | What it is for |
| --- | --- |
| `collections/postman-echo.postman_collection.json` | Minimal smoke test against postman-echo.com - 6 assertions, proves the setup works |
| `collections/jsonplaceholder.postman_collection.json` | A fuller worked example against jsonplaceholder.typicode.com - 9 requests, 38 assertions |

The JSONPlaceholder suite is meant to be read as a template for your own API. It
shows the things a real suite needs:

- **collection-level tests** that apply to every request (response time, content type)
- **JSON schema validation** with `pm.expect(...).to.have.jsonSchema(...)`
- **a chained flow** - the `crud` folder captures the id returned by the create
  step into a collection variable and interpolates it into the next request's URL
- **query parameters**, **negative cases** (404s), and a pre-request script that
  builds the payload

One honest caveat is baked into it: JSONPlaceholder only *simulates* writes.
`POST` answers `201` with id `101` but stores nothing, so the follow-up `GET`
asserts the `404` and says in a comment that a real backend would return `200`
and assert the payload. Tests that claim more than the API actually does are
worse than no tests.

## Adding your own collection

1. In Postman: **Collection → ... → Export → v2.1** and save it to `collections/`.
2. Optionally export the environment as well into `environments/`.
3. Run it:

```bash
./start.sh collections/my-api.postman_collection.json environments/stage.postman_environment.json
```

Anything that is not a secret can live in the repo. Keep tokens and passwords
out of the environment file and inject them as variables instead (see CI below).

## Options

`start.sh` forwards everything to `start.js`:

```
-c, --collection <file|url>   Postman collection (required)
-e, --environment <file|url>  Postman environment
-g, --globals <file|url>      Postman globals
-d, --iteration-data <file>   CSV/JSON data file for data-driven runs
-n, --iterations <number>     Number of iterations (default 1)
    --folder <name>           Run only this folder/request (repeatable)
    --reporters <list>        Comma separated (default: cli,htmlextra,allure)
    --report-dir <dir>        Where reports are written (default: reports)
    --timeout-request <ms>    Per request timeout (default 30000)
    --delay-request <ms>      Delay between requests (default 0)
    --bail                    Stop the run on the first failure
    --insecure                Disable strict SSL
-h, --help                    Show this help
```

Examples:

```bash
# run a single folder, twice, stop on first failure
./start.sh -c collections/my-api.postman_collection.json --folder smoke -n 2 --bail

# run a collection published by URL, add a junit report for CI
./start.sh -c https://example.com/my.postman_collection.json --reporters cli,junit

# data driven run
./start.sh -c collections/my-api.postman_collection.json -d data/users.csv
```

The exit code is `0` when every assertion passes, `1` when the run has failures
(so CI goes red), and `2` on a usage error such as a missing file.

## Reports

Everything lands in `reports/` (git-ignored):

| File | What it is |
| --- | --- |
| `reports/htmlResults.html` | standalone HTML report, open it in a browser |
| `reports/allure-results/` | raw Allure results |
| `reports/junitResults.xml` | JUnit XML, when `junit` is in `--reporters` |

To view the Allure report:

```bash
npm run allure:generate
npm run allure:open
```

## CI

`.github/workflows/newman.yml` runs **every collection in `collections/`** on
each push to `master`, on pull requests, nightly at 03:00 UTC, and on demand.
Each collection runs as its own matrix job, so one red suite does not hide the
others.

To run a single collection manually: **Actions → newman → Run workflow**, then
fill in the collection and environment paths. A manual run targets only what you
name there.

To add a collection to the matrix, add a pair to the `plan` job's `include`
list.

Reports are uploaded as build artifacts for 30 days, including for failed runs,
and the assertion results are published to the run summary.

### Secrets

Do not commit tokens. Add them as repository secrets and pass them into the run,
for example:

```yaml
      - name: Run collection
        env:
          API_TOKEN: ${{ secrets.API_TOKEN }}
        run: node start.js -c collections/my-api.postman_collection.json --reporters cli,junit
```

Then read the value in a pre-request script with `pm.environment.get` after
seeding it, or reference it through a Postman variable populated from the
environment.

### Jenkins

`Jenkinsfile` covers the same run for a Jenkins instance. It is parameterised
(`COLLECTION`, `ENVIRONMENT`), publishes the HTML report and needs the
HTML Publisher and Allure plugins.

## Security

`npm audit` is not clean, and it cannot be: every finding comes from inside
newman's own dependency tree, not from code in this repo.

What is fixed here, via `overrides` in `package.json` (24 findings down to 7,
including the only critical one):

| Package | Was | Now | Was reported as |
| --- | --- | --- | --- |
| `handlebars` | 4.7.7 / 4.7.8 | 4.7.9 | critical - JS injection via AST type confusion |
| `lodash` | 4.17.21 | 4.18.1 | high - code injection via `_.template` |
| `node-forge` | 1.3.1 | 1.4.0 | high - signature forgery, ASN.1 recursion |
| `underscore` | 1.12.1 | 1.13.8 | high - unbounded recursion DoS |
| `flatted` | 3.2.6 | 3.4.4 | high - prototype pollution |
| `uuid` | 9.0.1 | 11.x | moderate - missing buffer bounds check |
| `qs` | 6.14.2 | 6.16.0 | moderate - DoS via array-limit bypass |
| `jose` | 4.14.4 | 4.15.9 | moderate - resource exhaustion via crafted JWE |

Every override was verified against a real run: the demo collection, a
data-driven run, `{{$random*}}` dynamic variables and an HTTPS request all
still pass.

What is deliberately left alone:

- **`@faker-js/faker` (high)** - `postman-collection` pins `5.5.3` exactly and
  calls the v5 API (`faker.address.city`, `faker.random.arrayElement`,
  `faker.datatype.number`). The fix only exists in 10.6.0, where those names are
  gone, so forcing it breaks every `{{$random*}}` variable. The advisory is
  about `helpers.fake()` executing a crafted template - reachable only if you
  feed untrusted input into a dynamic variable.
- **`csv-parse` (moderate)** - the fix is in 7.0.2, newman calls the v4
  callback API. Forcing it fails the run outright with
  `TypeError: parseCsv is not a function`. Only reachable through
  `--iteration-data` with an untrusted CSV.

The remaining `newman`, `postman-*` and `newman-reporter-htmlextra` alerts are
transitive consequences of those two and will clear when upstream bumps them.

Do not run `npm audit fix --force`: its proposed "fix" is newman 4.6.1, a
three-major downgrade.
